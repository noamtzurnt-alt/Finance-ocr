import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const patchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.string().optional(),
  vendor: z.string().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  currency: z.string().optional(),
  cardLast4: z.string().nullable().optional(),
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.date) {
    const dt = parseDateOnly(parsed.data.date);
    if (!dt) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    data.date = dt;
  }
  if (parsed.data.amount) {
    const n = Number(parsed.data.amount.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    data.amount = n.toFixed(2);
  }
  if (parsed.data.vendor) data.vendor = parsed.data.vendor.trim();
  if (parsed.data.currency) data.currency = parsed.data.currency.trim();
  if ("description" in parsed.data) data.description = parsed.data.description ?? null;
  if ("categoryId" in parsed.data) data.categoryId = parsed.data.categoryId ?? null;
  if ("cardLast4" in parsed.data) data.cardLast4 = parsed.data.cardLast4 ?? null;

  const updated = await prisma.transaction.updateMany({
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
  const deleted = await prisma.transaction.deleteMany({ where: { id, userId: user.id } });
  if (deleted.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

