import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { putObject } from "@/app/lib/r2/objects";
import { prisma } from "@/app/lib/prisma";
import crypto from "crypto";
import { enqueueOcrJob } from "@/app/lib/ocr/worker";

const metaSchema = z.object({
  type: z.enum(["expense", "income", "payment_receipt"]),
  date: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  docNumber: z.string().nullable().optional(),
});

type Meta = z.infer<typeof metaSchema>;

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const metaRaw = formData.get("meta") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const meta: Meta = metaRaw ? metaSchema.parse(JSON.parse(metaRaw)) : { type: "expense" };

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Calculate SHA256 to detect duplicates
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  const existing = await prisma.document.findFirst({
    where: { userId: user.id, sha256: hash },
    select: { id: true, fileName: true },
  });

  if (existing) {
    return NextResponse.json({ 
      error: "duplicate", 
      message: `הקובץ כבר קיים במערכת בשם: ${existing.fileName}`,
      docId: existing.id 
    }, { status: 409 });
  }

  const fileKey = `${user.id}/${Date.now()}-${file.name}`;
  await putObject({ key: fileKey, body: buffer, contentType: file.type });

  const total = parseFloat(meta.amount || "0");
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { vatPercent: true } });
  const vatPct = dbUser?.vatPercent.toNumber() ?? 17;
  const vatAmount = total * (vatPct / (100 + vatPct));
  const preVatAmount = total - vatAmount;

  const doc = await prisma.document.create({
    data: {
      userId: user.id,
      type: meta.type,
      date: meta.date ? new Date(meta.date) : new Date(),
      amount: total,
      vatAmount: Math.round(vatAmount * 100) / 100,
      preVatAmount: Math.round(preVatAmount * 100) / 100,
      vendor: meta.vendor || "Unknown",
      categoryId: meta.categoryId || null,
      description: meta.description || null,
      docNumber: meta.docNumber ?? null,
      fileKey,
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      sha256: hash,
    },
  });

  await enqueueOcrJob({ userId: user.id, docId: doc.id });

  const listPath =
    meta.type === "expense" ? "/receipts"
    : meta.type === "income" ? "/invoices"
    : "/payment-receipts";
  revalidatePath(listPath);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, id: doc.id });
}
