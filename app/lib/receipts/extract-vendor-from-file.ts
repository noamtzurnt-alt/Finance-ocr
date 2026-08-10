import { prisma } from "@/app/lib/prisma";
import { getObjectBytes, objectExists } from "@/app/lib/r2/objects";
import { analyzeReceiptFile } from "@/app/lib/gmail/gemini";
import { parseDetectedReceiptDate } from "@/app/lib/receipts/analyze-expense-file";

export type ExtractVendorResult =
  | { ok: true; vendor: string; date: string | null }
  | { ok: false; reason: "not_found" | "file_missing" | "unsupported" | "no_vendor" };

/** Download a stored expense file and fill vendor (and missing amounts) from Gemini vision. */
export async function extractVendorFromStoredFile(input: {
  userId: string;
  documentId: string;
}): Promise<ExtractVendorResult> {
  const doc = await prisma.document.findFirst({
    where: { id: input.documentId, userId: input.userId },
    select: {
      id: true,
      fileKey: true,
      fileName: true,
      fileMime: true,
      amount: true,
      expenseFolderId: true,
      vendor: true,
      date: true,
    },
  });
  if (!doc) return { ok: false, reason: "not_found" };

  const mime = (doc.fileMime || "").toLowerCase();
  const name = doc.fileName.toLowerCase();
  const isHtml = mime.includes("html") || name.endsWith(".html");
  if (isHtml) return { ok: false, reason: "unsupported" };

  const exists = await objectExists(doc.fileKey);
  if (!exists) return { ok: false, reason: "file_missing" };

  const bytes = await getObjectBytes(doc.fileKey);
  if (!bytes) return { ok: false, reason: "file_missing" };

  const analysis = await analyzeReceiptFile({
    buffer: Buffer.from(bytes),
    mimeType: doc.fileMime || "application/octet-stream",
    fileName: doc.fileName,
  });

  const detectedDate = parseDetectedReceiptDate(analysis?.date);
  if (!analysis?.vendor && !detectedDate) return { ok: false, reason: "no_vendor" };

  const data: Record<string, unknown> = {};
  if (analysis?.vendor) data.vendor = analysis.vendor.slice(0, 200);
  if (detectedDate) data.date = detectedDate;

  if (Number(doc.amount) === 0 && analysis?.totalAmount && analysis.totalAmount > 0) {
    const total = analysis.totalAmount;
    const vat = analysis.vatAmount && analysis.vatAmount > 0 ? analysis.vatAmount : 0;
    data.amount = total;
    data.vatAmount = vat;
    data.preVatAmount = total - vat >= 0 ? total - vat : total;
  }
  if (analysis?.currency === "USD" || analysis?.currency === "EUR" || analysis?.currency === "ILS") {
    data.currency = analysis.currency;
  }

  await prisma.document.update({ where: { id: doc.id }, data });
  return {
    ok: true,
    vendor: analysis?.vendor?.slice(0, 200) || doc.vendor,
    date: detectedDate?.toISOString().slice(0, 10) ?? null,
  };
}
