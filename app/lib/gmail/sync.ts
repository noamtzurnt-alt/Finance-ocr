import { getGmailAccessToken } from "./oauth";
import { gmailQueryAfter } from "./detect";
import { writeEmailImportLog } from "./log";
import {
  detectSignedContractEmail,
  importSignedContractEmail,
  isContractInboxAccount,
} from "@/app/lib/contracts/email-import";
import {
  detectMorningReceiptEmail,
  importMorningReceiptEmail,
  isMorningReceiptInboxAccount,
  morningReceiptGmailQuery,
} from "@/app/lib/receipts/morning-email-import";
import { prisma } from "@/app/lib/prisma";

type GmailHeader = { name: string; value: string };
type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

type ParsedAttachment = {
  attachmentId: string;
  fileName: string;
  mimeType: string;
};

function headerValue(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string) {
  const pad = data.length % 4 === 0 ? "" : "=".repeat(4 - (data.length % 4));
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function walkParts(part: GmailPart | undefined, out: ParsedAttachment[]) {
  if (!part) return;
  if (part.body?.attachmentId && part.filename) {
    out.push({
      attachmentId: part.body.attachmentId,
      fileName: part.filename,
      mimeType: part.mimeType || "application/octet-stream",
    });
  }
  for (const child of part.parts ?? []) walkParts(child, out);
}

function extractHtmlBody(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data).toString("utf8");
  }
  for (const child of part.parts ?? []) {
    const html = extractHtmlBody(child);
    if (html) return html;
  }
  return "";
}

function extractTextBody(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data).toString("utf8");
  }
  for (const child of part.parts ?? []) {
    const text = extractTextBody(child);
    if (text) return text;
  }
  return "";
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `Gmail API ${res.status}`);
  return data;
}

async function listMessageIds(accessToken: string, query: string) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await gmailFetch<{ messages?: { id: string }[]; nextPageToken?: string }>(
      accessToken,
      `/messages?${url.searchParams.toString()}`,
    );
    for (const m of data.messages ?? []) ids.push(m.id);
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < 300);
  return ids;
}

async function downloadAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
) {
  const data = await gmailFetch<{ data?: string }>(
    accessToken,
    `/messages/${messageId}/attachments/${attachmentId}`,
  );
  if (!data.data) throw new Error("Empty attachment");
  return decodeBase64Url(data.data);
}

async function alreadyLogged(
  connectionId: string,
  messageId: string,
  attachmentId: string,
) {
  const row = await prisma.emailReceiptImport.findUnique({
    where: {
      gmailConnectionId_gmailMessageId_gmailAttachmentId: {
        gmailConnectionId: connectionId,
        gmailMessageId: messageId,
        gmailAttachmentId: attachmentId,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

function messageDate(msg: GmailMessage) {
  const ms = msg.internalDate ? Number(msg.internalDate) : Date.now();
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type SyncResult = {
  connectionId: string;
  emailAddress: string;
  scanned: number;
  imported: number;
  skipped: number;
  errors: number;
};

export async function syncGmailConnection(connectionId: string): Promise<SyncResult> {
  const conn = await prisma.gmailConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, userId: true, emailAddress: true, lastSyncAt: true },
  });
  if (!conn) throw new Error("Connection not found");

  await prisma.gmailConnection.update({
    where: { id: connectionId },
    data: { syncStatus: "syncing", lastError: null },
  });

  const result: SyncResult = {
    connectionId,
    emailAddress: conn.emailAddress,
    scanned: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Gmail serves exactly two strict flows:
    // 1. Signed contracts arriving at the contracts inbox.
    // 2. Green Invoice (Morning) income receipts arriving at the receipts inbox.
    // Generic expense imports stay disabled: broad detection created false positives.
    const isContractInbox = isContractInboxAccount(conn.emailAddress);
    const isMorningInbox = isMorningReceiptInboxAccount(conn.emailAddress);
    if (!isContractInbox && !isMorningInbox) {
      await prisma.gmailConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), syncStatus: "idle", lastError: null },
      });
      return result;
    }

    const accessToken = await getGmailAccessToken(connectionId);
    const since = conn.lastSyncAt
      ? new Date(conn.lastSyncAt.getTime() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let messageIds: string[];
    if (isMorningInbox) {
      // Only Green Invoice emails with a PDF — not the whole inbox.
      messageIds = await listMessageIds(
        accessToken,
        morningReceiptGmailQuery(gmailQueryAfter(since)),
      );
    } else {
      const recentMessageIds = await listMessageIds(accessToken, gmailQueryAfter(since));
      const historicalContractIds = await listMessageIds(
        accessToken,
        'newer_than:1y subject:"חוזה נחתם" has:attachment filename:pdf',
      );
      messageIds = [...new Set([...recentMessageIds, ...historicalContractIds])];
    }

    for (const messageId of messageIds) {
      result.scanned += 1;
      try {
        const msg = await gmailFetch<GmailMessage>(
          accessToken,
          `/messages/${messageId}?format=full`,
        );
        const headers = msg.payload?.headers ?? [];
        const subject = headerValue(headers, "Subject");
        const from = headerValue(headers, "From");
        const attachments: ParsedAttachment[] = [];
        walkParts(msg.payload, attachments);

        const htmlBody = extractHtmlBody(msg.payload);
        const textBody = extractTextBody(msg.payload);

        if (isMorningInbox) {
          const receiptMatch = detectMorningReceiptEmail({
            accountEmail: conn.emailAddress,
            from,
            subject,
            attachments,
          });
          if (!receiptMatch) {
            result.skipped += 1;
            continue;
          }

          if (await alreadyLogged(connectionId, messageId, receiptMatch.pdf.attachmentId)) {
            result.skipped += 1;
            continue;
          }

          const pdfBuffer = await downloadAttachment(
            accessToken,
            messageId,
            receiptMatch.pdf.attachmentId,
          );
          const imported = await importMorningReceiptEmail({
            userId: conn.userId,
            pdfBuffer,
            fileName: receiptMatch.pdf.fileName,
            subject,
            bodyText: textBody,
            messageDate: messageDate(msg),
            docNumber: receiptMatch.docNumber,
          });

          await writeEmailImportLog({
            userId: conn.userId,
            gmailConnectionId: connectionId,
            gmailMessageId: messageId,
            gmailAttachmentId: receiptMatch.pdf.attachmentId,
            status: imported.created ? "imported" : "duplicate",
            summary: imported.created
              ? `קבלה ירוקה נקלטה מהמייל: ${receiptMatch.pdf.fileName}`
              : "הקבלה כבר קיימת (נקלטה מה־webhook או מסנכרון קודם)",
            documentId: imported.docId ?? null,
            subject,
            sender: from,
            detail: { source: "morning-email", docNumber: receiptMatch.docNumber },
          });
          if (imported.created) result.imported += 1;
          else result.skipped += 1;
          continue;
        }

        const contractMatch = detectSignedContractEmail({
          accountEmail: conn.emailAddress,
          subject,
          htmlBody,
          textBody,
          attachments,
        });

        if (contractMatch) {
          const attachmentId = contractMatch.pdf.attachmentId;
          const pdfBuffer = await downloadAttachment(accessToken, messageId, attachmentId);
          const imported = await importSignedContractEmail({
            userId: conn.userId,
            gmailConnectionId: connectionId,
            gmailMessageId: messageId,
            subject,
            from,
            messageDate: messageDate(msg),
            htmlBody,
            textBody,
            match: contractMatch,
            pdfBuffer,
          });

          await writeEmailImportLog({
            userId: conn.userId,
            gmailConnectionId: connectionId,
            gmailMessageId: messageId,
            gmailAttachmentId: attachmentId,
            status: imported.created ? "contract_imported" : "duplicate",
            summary: imported.created
              ? `חוזה נקלט: ${contractMatch.clientName}`
              : `החוזה של ${contractMatch.clientName} כבר קיים`,
            subject,
            sender: from,
            overwriteExisting: true,
            detail: {
              contractId: imported.contractId,
              clientName: contractMatch.clientName,
              clientEmail: contractMatch.clientEmail,
              source: "signed-contract-email",
            },
          });
          if (imported.created) result.imported += 1;
          else result.skipped += 1;
          continue;
        }

        // This connection is contract-only. Never classify ordinary emails as
        // recognized expenses, even if they contain payment-related words.
        result.skipped += 1;
        continue;

        /*
         * Legacy expense-email importer intentionally disabled.
         * Gmail now serves only the strict signed-contract flow above.
        const analysis: ReceiptAnalysis = await analyzeReceiptEmail({
          subject,
          snippet,
          from,
          attachmentNames: attachments.map((a) => a.fileName),
          hasAllowedAttachment: allowed.length > 0,
          body,
        });

        const vendor = analysis.vendor || parseSenderName(from);
        const docDate = analysis.date ? parseAnalysisDate(analysis.date) : messageDate(msg);

        if (!analysis.isReceipt) {
          if (!(await alreadyLogged(connectionId, messageId, ""))) {
            await writeEmailImportLog({
              userId: conn.userId,
              gmailConnectionId: connectionId,
              gmailMessageId: messageId,
              status: "not_receipt",
              summary: `לא זוהה כקבלה (${analysis.source === "gemini" ? "AI" : "מילות מפתח"})`,
              subject,
              sender: from,
              detail: { subject, snippet: snippet.slice(0, 200), source: analysis.source },
            });
          }
          result.skipped += 1;
          continue;
        }

        let importedAny = false;

        if (allowed.length > 0) {
          for (const att of allowed) {
            if (await alreadyLogged(connectionId, messageId, att.attachmentId)) {
              result.skipped += 1;
              continue;
            }

            const buffer = await downloadAttachment(accessToken, messageId, att.attachmentId);

            // Read the actual receipt file (PDF/image) to pull the supplier name and
            // amounts straight from the document, instead of relying on the email sender.
            const fileAnalysis = await analyzeReceiptFile({
              buffer,
              mimeType: att.mimeType,
              fileName: att.fileName,
            });
            const fileVendor = fileAnalysis?.vendor?.trim() || "";
            const attVendor = fileVendor || vendor;

            const created = await createExpenseDocument({
              userId: conn.userId,
              expenseFolderId: folderId,
              buffer,
              fileName: att.fileName,
              fileMime: att.mimeType,
              date: fileAnalysis?.date ? parseAnalysisDate(fileAnalysis.date) : docDate,
              vendor: attVendor,
              description: subject || null,
              amount: fileAnalysis?.totalAmount ?? analysis.totalAmount ?? undefined,
              vatAmount: fileAnalysis?.vatAmount ?? analysis.vatAmount ?? undefined,
              currency: fileAnalysis?.currency ?? analysis.currency,
              sourceUrl: analysis.downloadUrl,
              needsReview: true,
            });

            if (!created.ok) {
              await writeEmailImportLog({
                userId: conn.userId,
                gmailConnectionId: connectionId,
                gmailMessageId: messageId,
                gmailAttachmentId: att.attachmentId,
                status: "duplicate",
                summary: "קובץ כבר קיים במערכת",
                documentId: created.docId,
                subject,
                sender: from,
              });
              result.skipped += 1;
              continue;
            }

            await writeEmailImportLog({
              userId: conn.userId,
              gmailConnectionId: connectionId,
              gmailMessageId: messageId,
              gmailAttachmentId: att.attachmentId,
              status: "imported",
              summary: `נקלט: ${att.fileName}${analysis.totalAmount ? ` · ${analysis.totalAmount} ${analysis.currency ?? ""}` : ""}`,
              documentId: created.docId,
              subject,
              sender: from,
              detail: {
                source: fileVendor ? "gemini-file" : analysis.source,
                vendor: attVendor,
                amount: fileAnalysis?.totalAmount ?? analysis.totalAmount,
              },
            });
            importedAny = true;
            result.imported += 1;
          }
        } else {
          if (await alreadyLogged(connectionId, messageId, "")) {
            result.skipped += 1;
            continue;
          }

          const dateStr = docDate.toISOString().slice(0, 10);
          const htmlDoc = buildEmailReceiptHtml({
            from,
            subject: subject || "(ללא נושא)",
            date: dateStr,
            bodyHtml: (body || snippet).replace(/\n/g, "<br>"),
          });
          const buffer = Buffer.from(htmlDoc, "utf8");
          const fileName = `email-${messageId.slice(0, 12)}.html`;

          const created = await createExpenseDocument({
            userId: conn.userId,
            expenseFolderId: folderId,
            buffer,
            fileName,
            fileMime: "text/html",
            date: docDate,
            vendor,
            description: subject || null,
            amount: analysis.totalAmount ?? undefined,
            vatAmount: analysis.vatAmount ?? undefined,
            currency: analysis.currency,
            sourceUrl: analysis.downloadUrl,
            needsReview: true,
          });

          if (!created.ok) {
            await writeEmailImportLog({
              userId: conn.userId,
              gmailConnectionId: connectionId,
              gmailMessageId: messageId,
              status: "duplicate",
              summary: "תוכן המייל כבר קיים במערכת",
              documentId: created.docId,
              subject,
              sender: from,
            });
            result.skipped += 1;
            continue;
          }

          const linkNote = analysis.downloadUrl ? " · יש קישור לקבלה מקורית" : "";
          await writeEmailImportLog({
            userId: conn.userId,
            gmailConnectionId: connectionId,
            gmailMessageId: messageId,
            status: "imported",
            summary: `נקלט מתוכן מייל: ${subject || fileName}${linkNote}`,
            documentId: created.docId,
            subject,
            sender: from,
            detail: { source: analysis.source, downloadUrl: analysis.downloadUrl, amount: analysis.totalAmount },
          });
          importedAny = true;
          result.imported += 1;
        }

        if (!importedAny && allowed.length === 0) {
          result.skipped += 1;
        }
        */
      } catch (e) {
        result.errors += 1;
        await writeEmailImportLog({
          userId: conn.userId,
          gmailConnectionId: connectionId,
          gmailMessageId: messageId,
          status: "error",
          summary: e instanceof Error ? e.message : "שגיאה בעיבוד מייל",
        });
      }
    }

    await prisma.gmailConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), syncStatus: "idle", lastError: null },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    await prisma.gmailConnection.update({
      where: { id: connectionId },
      data: { syncStatus: "error", lastError: msg },
    });
    throw e;
  }

  return result;
}

export async function syncAllGmailForUser(userId: string) {
  const connections = await prisma.gmailConnection.findMany({
    where: { userId },
    select: { id: true },
  });
  const results: SyncResult[] = [];
  for (const c of connections) {
    results.push(await syncGmailConnection(c.id));
  }
  return results;
}

export async function syncAllGmailConnections() {
  const connections = await prisma.gmailConnection.findMany({ select: { id: true } });
  const results: SyncResult[] = [];
  for (const c of connections) {
    try {
      results.push(await syncGmailConnection(c.id));
    } catch (e) {
      console.error("[gmail cron]", c.id, e);
    }
  }
  return results;
}
