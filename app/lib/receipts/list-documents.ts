import { prisma } from "@/app/lib/prisma";

export type DocumentRow = {
  id: string;
  type: string;
  date: string;
  amount: string;
  currency: string;
  vendor: string;
  docNumber: string | null;
  description: string | null;
  sourceUrl: string | null;
  needsReview: boolean;
  categoryId: string | null;
  categoryName: string | null;
  fileName: string;
};

function parseDateOnly(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function getDocumentsList(
  userId: string,
  filters: {
    type?: "expense" | "income" | "payment_receipt";
    q?: string;
    categoryId?: string;
    from?: string;
    to?: string;
    reviewOnly?: boolean;
    limit?: number;
    cursor?: string;
  },
): Promise<{ items: DocumentRow[]; nextCursor: string | null }> {
  const limit = Math.min(200, Math.max(10, filters.limit ?? 50));

  if (filters.type === "income") {
    return { items: [], nextCursor: null };
  }

  const where: Record<string, unknown> = {
    userId,
    type: filters.type ?? { not: "income" },
  };

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.reviewOnly) where.needsReview = true;

  if (filters.from) {
    const dt = parseDateOnly(filters.from);
    if (dt) where.date = { ...(where.date as object), gte: dt };
  }
  if (filters.to) {
    const dt = parseDateOnly(filters.to);
    if (dt) {
      const next = new Date(dt);
      next.setDate(next.getDate() + 1);
      where.date = { ...(where.date as object), lt: next };
    }
  }

  const q = (filters.q ?? "").trim();
  if (q) {
    where.OR = [
      { vendor: { contains: q, mode: "insensitive" } },
      { docNumber: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { fileName: { contains: q, mode: "insensitive" } },
    ];
  }

  const cursor = filters.cursor ? { id: filters.cursor } : undefined;

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

  return {
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
  };
}
