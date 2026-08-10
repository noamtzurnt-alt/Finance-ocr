import { analyzeReceiptFile } from "@/app/lib/gmail/gemini";

const EARLIEST_RECEIPT_YEAR = 2000;

export function parseDetectedReceiptDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Prisma stores this field as SQL DATE. UTC midnight preserves the printed
  // calendar day and avoids shifting it one day backwards in Israel time.
  const date = new Date(Date.UTC(year, month - 1, day));
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7);

  if (
    year < EARLIEST_RECEIPT_YEAR ||
    date > maxDate ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export async function analyzeExpenseFile(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  fallbackDate: Date;
}) {
  const analysis = await analyzeReceiptFile({
    buffer: input.buffer,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });

  const detectedDate = parseDetectedReceiptDate(analysis?.date);
  const total = analysis?.totalAmount && analysis.totalAmount > 0
    ? analysis.totalAmount
    : 0;
  const vat = analysis?.vatAmount && analysis.vatAmount > 0
    ? analysis.vatAmount
    : 0;

  return {
    date: detectedDate ?? input.fallbackDate,
    dateDetected: Boolean(detectedDate),
    vendor: analysis?.vendor?.trim().slice(0, 200) || "לא צוין",
    amount: total,
    vatAmount: Math.min(vat, total),
    currency:
      analysis?.currency === "USD" || analysis?.currency === "EUR"
        ? analysis.currency
        : "ILS",
  };
}
