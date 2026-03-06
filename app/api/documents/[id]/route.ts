import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { deleteObject, getObjectReadUrl } from "@/app/lib/r2/objects";

const numOrStr = z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? parseFloat(v) : v));

const updateSchema = z.object({
  type: z.enum(["expense", "income", "payment_receipt"]).optional(),
  date: z.string().optional(), // YYYY-MM-DD
  amount: numOrStr.optional(),
  vatAmount: numOrStr.optional(),
  preVatAmount: numOrStr.optional(),
  isRecognized: numOrStr.optional(),
  vendor: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  docNumber: z.string().nullable().optional(),
});

function parseDateOnly(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await getObjectReadUrl(doc.fileKey);

  return NextResponse.json({
    id: doc.id,
    type: doc.type,
    date: doc.date.toISOString().slice(0, 10),
    amount: doc.amount.toString(),
    vendor: doc.vendor,
    categoryId: doc.categoryId,
    categoryName: doc.category?.name ?? null,
    description: doc.description,
    docNumber: doc.docNumber,
    fileName: doc.fileName,
    fileMime: doc.fileMime,
    fileUrl: url,
    ocrStatus: doc.ocrStatus,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.type !== undefined) data.type = parsed.data.type;
  if (parsed.data.date !== undefined) {
    const dt = parseDateOnly(parsed.data.date);
    if (!dt) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    data.date = dt;
  }
  if (parsed.data.amount !== undefined) data.amount = Number(parsed.data.amount);
  if (parsed.data.vatAmount !== undefined) data.vatAmount = Number(parsed.data.vatAmount);
  if (parsed.data.preVatAmount !== undefined) data.preVatAmount = Number(parsed.data.preVatAmount);
  if (parsed.data.isRecognized !== undefined) data.isRecognized = Number(parsed.data.isRecognized);
  if (parsed.data.vendor !== undefined) data.vendor = parsed.data.vendor;
  if (parsed.data.categoryId !== undefined) data.categoryId = parsed.data.categoryId?.trim() || null;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.docNumber !== undefined) data.docNumber = parsed.data.docNumber;

  const updated = await prisma.document.updateMany({
    where: { id, userId: user.id },
    data,
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteObject(doc.fileKey);
  await prisma.document.delete({ where: { id: doc.id } });

  return NextResponse.json({ ok: true });
}


