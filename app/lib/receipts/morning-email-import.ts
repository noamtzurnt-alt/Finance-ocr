import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { putObject } from "@/app/lib/r2/objects";
import { analyzeReceiptFile } from "@/app/lib/gmail/gemini";

/** Inbox that receives copies of Green Invoice (Morning) income receipts. */
export const MORNING_RECEIPTS_GMAIL_ACCOUNT = "noamtzurnt@gmail.com";

/** Only emails actually sent by Green Invoice / Morning are considered. */
const MORNING_SENDER_RE = /(greeninvoice\.co\.il|morning\.co\.il)/i;

export function isMorningReceiptInboxAccount(emailAddress: string) {
  return emailAddress.trim().toLowerCase() === MORNING_RECEIPTS_GMAIL_ACCOUNT;
}

/** Gmail search that narrows the scan to Green Invoice emails with a PDF. */
export function morningReceiptGmailQuery(afterClause: string) {
  return `from:(greeninvoice.co.il OR morning.co.il) filename:pdf ${afterClause}`.trim();
}

type ReceiptAttachment = {
  attachmentId: string;
  fileName: string;
  mimeType: string;
};

export type MorningReceiptMatch = {
  pdf: ReceiptAttachment;
  docNumber: string | null;
};

function isPdf(att: ReceiptAttachment) {
  return (
    att.mimeType.toLowerCase() === "application/pdf" ||
    att.fileName.toLowerCase().endsWith(".pdf")
  );
}

/**
 * Strict detection: sender must be Green Invoice / Morning, the subject must
 * mention a receipt (קבלה covers both קבלה and חשבונית מס/קבלה), and a PDF
 * must be attached. Everything else is skipped.
 */
export function detectMorningReceiptEmail(input: {
  accountEmail: string;
  from: string;
  subject: string;
  attachments: ReceiptAttachment[];
}): MorningReceiptMatch | null {
  if (!isMorningReceiptInboxAccount(input.accountEmail)) return null;
  if (!MORNING_SENDER_RE.test(input.from)) return null;
  if (!/קבלה/.test(input.subject)) return null;
  // Non-receipt documents (quotes, order confirmations, etc.) are excluded
  // unless the subject explicitly says receipt, which the check above enforces.

  const pdf = input.attachments.find(isPdf);
  if (!pdf) return null;

  const docNumber = input.subject.match(/(\d{2,})/)?.[1] ?? null;
  return { pdf, docNumber };
}

function parseClientName(subject: string, bodyText: string) {
  for (const source of [bodyText, subject]) {
    const m =
      source.match(/(?:עבור|לכבוד)\s*[:\-]?\s*([^\n,.;]+)/)?.[1] ??
      source.match(/ללקוח(?:ה)?\s*[:\-]?\s*([^\n,.;]+)/)?.[1];
    const name = m?.trim().slice(0, 120);
    if (name) return name;
  }
  return null;
}

export type MorningEmailImportResult =
  | { created: true; docId: string }
  | { created: false; docId?: string; reason: "duplicate" };

export async function importMorningReceiptEmail(input: {
  userId: string;
  pdfBuffer: Buffer;
  fileName: string;
  subject: string;
  bodyText: string;
  messageDate: Date;
  docNumber: string | null;
}): Promise<MorningEmailImportResult> {
  const hash = crypto.createHash("sha256").update(input.pdfBuffer).digest("hex");

  // Same PDF may already exist via the Morning webhook — never import twice.
  const byHash = await prisma.document.findFirst({
    where: { userId: input.userId, sha256: hash },
    select: { id: true },
  });
  if (byHash) return { created: false, docId: byHash.id, reason: "duplicate" };

  if (input.docNumber) {
    const byNumber = await prisma.document.findFirst({
      where: {
        userId: input.userId,
        type: "payment_receipt",
        docNumber: input.docNumber,
      },
      select: { id: true },
    });
    if (byNumber) return { created: false, docId: byNumber.id, reason: "duplicate" };
  }

  // Read totals straight from the receipt PDF (best effort).
  const analysis = await analyzeReceiptFile({
    buffer: input.pdfBuffer,
    mimeType: "application/pdf",
    fileName: input.fileName,
  });

  const dbUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { vatPercent: true },
  });
  const vatPct = dbUser?.vatPercent.toNumber() ?? 18;
  const total = analysis?.totalAmount ?? 0;
  const vatAmount =
    analysis?.vatAmount ?? (total > 0 ? total * (vatPct / (100 + vatPct)) : 0);
  const preVatAmount = total - vatAmount;

  const date = analysis?.date ? parseIsoDate(analysis.date) : input.messageDate;
  const clientName = parseClientName(input.subject, input.bodyText) ?? "לקוח Morning";

  const safeName = input.fileName.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 120) || "receipt.pdf";
  const fileKey = `${input.userId}/morning/${Date.now()}-${safeName}`;

  await putObject({
    key: fileKey,
    body: input.pdfBuffer,
    contentType: "application/pdf",
  });

  const created = await prisma.document.create({
    data: {
      userId: input.userId,
      type: "payment_receipt",
      date,
      amount: Math.round(total * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      preVatAmount: Math.round(preVatAmount * 100) / 100,
      vendor: clientName.slice(0, 200),
      description: input.subject.slice(0, 2000) || null,
      docNumber: input.docNumber,
      fileKey,
      fileName: safeName,
      fileMime: "application/pdf",
      fileSize: input.pdfBuffer.length,
      sha256: hash,
      currency:
        analysis?.currency === "USD" || analysis?.currency === "EUR"
          ? analysis.currency
          : "ILS",
    },
    select: { id: true },
  });

  revalidatePath("/payment-receipts");
  revalidatePath("/dashboard");

  return { created: true, docId: created.id };
}

function parseIsoDate(raw: string): Date {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
