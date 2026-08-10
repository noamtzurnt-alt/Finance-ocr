import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const querySchema = z.object({
  q: z.string().optional(),
  type: z.enum(["expense", "income", "payment_receipt"]).optional(),
  categoryId: z.string().optional(),
  from: z.string().optional(), // YYYY-MM-DD
  to: z.string().optional(), // YYYY-MM-DD (inclusive)
  review: z.string().optional(), // "1" = only needsReview
  limit: z.string().optional(),
  cursor: z.string().optional(),
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
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    review: url.searchParams.get("review") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const q = (parsed.data.q ?? "").trim();
  const type = parsed.data.type;
  const categoryId = (parsed.data.categoryId ?? "").trim();
  const limit = Math.min(200, Math.max(10, Number(parsed.data.limit ?? "50") || 50));

  if (type === "income") {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const where: Record<string, unknown> = {
    userId: user.id,
    type: type ?? { not: "income" },
  };

  if (categoryId) where.categoryId = categoryId;
  if (parsed.data.review === "1") where.needsReview = true;

  if (parsed.data.from) {
    const dt = parseDateOnly(parsed.data.from);
    if (!dt) return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
    where.date = { ...(where.date as object), gte: dt };
  }
  if (parsed.data.to) {
    const dt = parseDateOnly(parsed.data.to);
    if (!dt) return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
    const next = new Date(dt);
    next.setDate(next.getDate() + 1);
    where.date = { ...(where.date as object), lt: next };
  }

  if (q) {
    // Search across vendor/docNumber/description (case-insensitive)
    where.OR = [
      { vendor: { contains: q, mode: "insensitive" } },
      { docNumber: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { fileName: { contains: q, mode: "insensitive" } },
    ];
  }

  const cursor = parsed.data.cursor ? { id: parsed.data.cursor } : undefined;

  const docs = await prisma.document.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    ...(cursor ? { cursor, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      date: true,
      amount: true,
      currency: true,
      vendor: true,
      docNumber: true,
      description: true,
      sourceUrl: true,
      needsReview: true,
      category: { select: { id: true, name: true } },
      fileName: true,
    },
  });

  const nextCursor = docs.length === limit ? docs[docs.length - 1]?.id ?? null : null;

  return NextResponse.json({
    items: docs.map((d) => ({
      id: d.id,
      type: d.type,
      date: d.date.toISOString().slice(0, 10),
      amount: d.amount.toString(),
      currency: d.currency,
      vendor: d.vendor,
      docNumber: d.docNumber,
      description: d.description,
      sourceUrl: d.sourceUrl,
      needsReview: d.needsReview,
      categoryId: d.category?.id ?? null,
      categoryName: d.category?.name ?? null,
      fileName: d.fileName,
    })),
    nextCursor,
  });
}

