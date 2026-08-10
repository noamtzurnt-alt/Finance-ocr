import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { putObject } from "@/app/lib/r2/objects";

export type CreateExpenseInput = {
  userId: string;
  expenseFolderId?: string | null;
  buffer: Buffer;
  fileName: string;
  fileMime: string;
  date: Date;
  vendor: string;
  description?: string | null;
  amount?: number;
  vatAmount?: number;
  currency?: string | null;
  sourceUrl?: string | null;
  needsReview?: boolean;
};

export async function createExpenseDocument(input: CreateExpenseInput) {
  const hash = crypto.createHash("sha256").update(input.buffer).digest("hex");

  const existing = await prisma.document.findFirst({
    where: { userId: input.userId, sha256: hash },
    select: { id: true, fileName: true },
  });
  if (existing) {
    return { ok: false as const, reason: "duplicate" as const, docId: existing.id };
  }

  const fileKey = `${input.userId}/expenses/${Date.now()}-${input.fileName.replace(/[/\\]/g, "_")}`;
  await putObject({
    key: fileKey,
    body: input.buffer,
    contentType: input.fileMime || "application/octet-stream",
  });

  const total = input.amount ?? 0;
  const vat = input.vatAmount ?? 0;
  const preVat = total - vat;
  const doc = await prisma.document.create({
    data: {
      userId: input.userId,
      type: "expense",
      date: input.date,
      amount: total,
      vatAmount: vat > 0 ? vat : 0,
      preVatAmount: preVat >= 0 ? preVat : total,
      currency:
        input.currency === "USD" || input.currency === "EUR" ? input.currency : "ILS",
      vendor: input.vendor.slice(0, 200),
      description: input.description?.slice(0, 2000) || null,
      expenseFolderId: input.expenseFolderId ?? null,
      sourceUrl: input.sourceUrl ?? null,
      needsReview: input.needsReview ?? false,
      fileKey,
      fileName: input.fileName,
      fileMime: input.fileMime || "application/octet-stream",
      fileSize: input.buffer.length,
      sha256: hash,
    },
    select: { id: true },
  });

  revalidatePath("/receipts");
  revalidatePath("/dashboard");

  return { ok: true as const, docId: doc.id };
}
