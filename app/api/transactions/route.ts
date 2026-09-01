import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getTransactionsList } from "@/app/lib/transactions/list";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string(),
  vendor: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  currency: z.string().optional(),
  cardLast4: z.string().optional().nullable(),
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
  const yearRaw = url.searchParams.get("year")?.trim() || "";
  const monthRaw = url.searchParams.get("month")?.trim() || "";

  let year: number | undefined;
  let month: number | undefined;
  if (yearRaw) {
    const y = Number(yearRaw);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    year = y;
    if (monthRaw) {
      const m = Number(monthRaw);
      if (!Number.isFinite(m) || m < 1 || m > 12) {
        return NextResponse.json({ error: "Invalid month" }, { status: 400 });
      }
      month = m;
    }
  }

  const items = await getTransactionsList(user.id, { limit, year, month });
  return NextResponse.json(items);
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
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
