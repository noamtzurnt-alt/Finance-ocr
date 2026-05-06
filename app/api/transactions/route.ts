import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string(),
  vendor: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  currency: z.string().optional(),
  cardLast4: z.string().optional().nullable(),
  isFixed: z.boolean().optional(),
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

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") ?? "100") || 100));
  const year = url.searchParams.get("year")?.trim() || "";
  const month = url.searchParams.get("month")?.trim() || "";

  const where: Record<string, unknown> = { userId: user.id };
  if (year) {
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    if (month) {
      const m = Number(month);
      if (!Number.isFinite(m) || m < 1 || m > 12) {
        return NextResponse.json({ error: "Invalid month" }, { status: 400 });
      }
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      where.date = { gte: start, lt: end };
    } else {
      const start = new Date(y, 0, 1);
      const end = new Date(y + 1, 0, 1);
      where.date = { gte: start, lt: end };
    }
  }

  const items = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { category: { select: { name: true } } },
  });

  return NextResponse.json(
    items.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      amount: t.amount.toString(),
      currency: t.currency,
      vendor: t.vendor,
      description: t.description,
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? null,
      cardLast4: t.cardLast4,
      isFixed: t.isFixed,
      updatedAt: t.updatedAt.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const dt = parseDateOnly(parsed.data.date);
  if (!dt) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const n = Number(parsed.data.amount.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const created = await prisma.transaction.create({
    data: {
      userId: user.id,
      date: dt,
      amount: n.toFixed(2),
      currency: parsed.data.currency?.trim() || "ILS",
      vendor: parsed.data.vendor.trim(),
      description: parsed.data.description?.trim() || null,
      categoryId: parsed.data.categoryId || null,
      cardLast4: parsed.data.cardLast4?.trim() || null,
      isFixed: parsed.data.isFixed ?? false,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}

