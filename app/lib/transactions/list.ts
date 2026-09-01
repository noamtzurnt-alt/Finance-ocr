import { prisma } from "@/app/lib/prisma";

export type TransactionRow = {
  id: string;
  date: string;
  amount: string;
  currency: string;
  vendor: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryScope: "personal" | "business" | null;
  cardLast4: string | null;
  updatedAt: string;
};

export async function getTransactionsList(
  userId: string,
  opts: { limit?: number; year?: number; month?: number } = {},
): Promise<TransactionRow[]> {
  const limit = Math.min(200, Math.max(10, opts.limit ?? 200));

  const where: Record<string, unknown> = { userId };
  if (opts.year) {
    if (opts.month) {
      const start = new Date(opts.year, opts.month - 1, 1);
      const end = new Date(opts.year, opts.month, 1);
      where.date = { gte: start, lt: end };
    } else {
      const start = new Date(opts.year, 0, 1);
      const end = new Date(opts.year + 1, 0, 1);
      where.date = { gte: start, lt: end };
    }
  }

  const items = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { category: { select: { name: true, budgetScope: true } } },
  });

  return items.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    amount: t.amount.toString(),
    currency: t.currency,
    vendor: t.vendor,
    description: t.description,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    categoryScope: t.category?.budgetScope ?? null,
    cardLast4: t.cardLast4,
    updatedAt: t.updatedAt.toISOString(),
  }));
}
