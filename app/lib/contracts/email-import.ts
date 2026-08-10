import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";
import { deleteObject, putObject } from "@/app/lib/r2/objects";
import { buildEmailReceiptHtml } from "@/app/lib/gmail/detect";

export const CONTRACT_GMAIL_ACCOUNT = "ntdigitaldomain@gmail.com";

const HEBREW_MONTHS: Record<string, number> = {
  ינואר: 0,
  פברואר: 1,
  מרץ: 2,
  אפריל: 3,
  מאי: 4,
  יוני: 5,
  יולי: 6,
  אוגוסט: 7,
  ספטמבר: 8,
  אוקטובר: 9,
  נובמבר: 10,
  דצמבר: 11,
};

type ContractAttachment = {
  attachmentId: string;
  fileName: string;
  mimeType: string;
};

export type SignedContractMatch = {
  clientName: string;
  clientEmail: string | null;
  contractDate: Date | null;
  pdf: ContractAttachment;
};

export function isContractInboxAccount(emailAddress: string) {
  return emailAddress.trim().toLowerCase() === CONTRACT_GMAIL_ACCOUNT;
}

function htmlToText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function cleanClientName(value: string) {
  return value
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/[|–—-]+\s*$/, "")
    .trim()
    .slice(0, 120);
}

function parseClientName(subject: string, text: string) {
  const fromBody = text.match(/לקוח(?:ה)?\s*:\s*([^\n\r]+)/i)?.[1];
  if (fromBody) {
    const name = cleanClientName(fromBody);
    if (name) return name;
  }

  const fromSubject = subject.match(/חוזה\s+נחתם\s*[,،:：\-–—]?\s*(.+)$/i)?.[1];
  return fromSubject ? cleanClientName(fromSubject) : "";
}

function parseClientEmail(text: string) {
  const labelled = text.match(/(?:דוא["״']?ל|אימייל|email)\s*:\s*([^\s<>,;]+@[^\s<>,;]+)/i)?.[1];
  if (labelled) return labelled.trim().toLowerCase().slice(0, 254);
  return null;
}

function parseSigningDate(text: string) {
  const match = text.match(
    /תאריך\s+חתימה\s*:\s*(\d{1,2})\s+ב?[־-]?(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(\d{4})/i,
  );
  if (!match) return null;
  const month = HEBREW_MONTHS[match[2]];
  if (month == null) return null;
  const date = new Date(Number(match[3]), month, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPdf(att: ContractAttachment) {
  return att.mimeType.toLowerCase() === "application/pdf" || att.fileName.toLowerCase().endsWith(".pdf");
}

export function detectSignedContractEmail(input: {
  accountEmail: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  attachments: ContractAttachment[];
}): SignedContractMatch | null {
  if (!isContractInboxAccount(input.accountEmail)) return null;

  const text = input.textBody.trim() || htmlToText(input.htmlBody);
  const subjectLooksRight = /חוזה\s+נחתם/i.test(input.subject);
  const bodyLooksRight = /חוזה\s+נחתם\s+דיגיטלית/i.test(text) && /תאריך\s+חתימה\s*:/i.test(text);
  if (!subjectLooksRight || !bodyLooksRight) return null;

  const pdfs = input.attachments.filter(isPdf);
  const pdf =
    pdfs.find((att) => /contract|חוזה/i.test(att.fileName) && /signed|חתום/i.test(att.fileName)) ??
    pdfs[0];
  if (!pdf) return null;

  const clientName = parseClientName(input.subject, text);
  if (!clientName) return null;

  return {
    clientName,
    clientEmail: parseClientEmail(text),
    contractDate: parseSigningDate(text),
    pdf,
  };
}

function safeFilePart(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "contract";
}

export async function importSignedContractEmail(input: {
  userId: string;
  gmailConnectionId: string;
  gmailMessageId: string;
  subject: string;
  from: string;
  messageDate: Date;
  htmlBody: string;
  textBody: string;
  match: SignedContractMatch;
  pdfBuffer: Buffer;
}) {
  const existing = await prisma.contract.findFirst({
    where: {
      gmailConnectionId: input.gmailConnectionId,
      gmailMessageId: input.gmailMessageId,
    },
    select: { id: true },
  });
  if (existing) return { created: false as const, contractId: existing.id };

  const date = input.match.contractDate ?? input.messageDate;
  const datePart = date.toISOString().slice(0, 10);
  const clientPart = safeFilePart(input.match.clientName);
  const nonce = crypto.randomUUID();
  const pdfName = `${clientPart}-${datePart}-signed.pdf`;
  const htmlName = `${clientPart}-${datePart}-email.html`;
  const pdfKey = `${input.userId}/contracts/email/${nonce}-${pdfName}`;
  const htmlKey = `${input.userId}/contracts/email/${nonce}-${htmlName}`;
  const bodyForArchive = input.htmlBody || input.textBody.replace(/\n/g, "<br>");
  const html = buildEmailReceiptHtml({
    from: input.from,
    subject: input.subject || "חוזה נחתם",
    date: datePart,
    bodyHtml: bodyForArchive,
  });
  const htmlBuffer = Buffer.from(html, "utf8");

  await putObject({
    key: pdfKey,
    body: input.pdfBuffer,
    contentType: "application/pdf",
  });

  try {
    await putObject({
      key: htmlKey,
      body: htmlBuffer,
      contentType: "text/html; charset=utf-8",
    });

    const contract = await prisma.contract.create({
      data: {
        userId: input.userId,
        clientName: input.match.clientName,
        clientEmail: input.match.clientEmail,
        contractDate: date,
        details: "נקלט אוטומטית ממייל חתימה דיגיטלית",
        fileKey: pdfKey,
        fileName: pdfName,
        fileMime: "application/pdf",
        fileSize: input.pdfBuffer.length,
        emailHtmlKey: htmlKey,
        emailHtmlFileName: htmlName,
        emailHtmlSize: htmlBuffer.length,
        gmailConnectionId: input.gmailConnectionId,
        gmailMessageId: input.gmailMessageId,
      },
      select: { id: true },
    });
    return { created: true as const, contractId: contract.id };
  } catch (error) {
    await Promise.allSettled([deleteObject(pdfKey), deleteObject(htmlKey)]);
    throw error;
  }
}
