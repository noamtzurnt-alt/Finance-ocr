import { prisma } from "@/app/lib/prisma";
import { CHAT_LIST_LIMIT, type ListedTransaction } from "@/app/lib/transactions/chat-list";
import { getUserBudgetCycle } from "@/app/lib/budget/cycle";

export async function fetchListedTransactions(
  userId: string,
  refDate = new Date(),
): Promise<ListedTransaction[]> {
  const { start, end } = await getUserBudgetCycle(userId, refDate);
  // Chronological: start of cycle at top, end of cycle at bottom while scrolling down.
  const rows = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }, { updatedAt: "asc" }],
    take: CHAT_LIST_LIMIT,
    select: {
      id: true,
      vendor: true,
      amount: true,
      currency: true,
      description: true,
      cardLast4: true,
      date: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });

  return rows.map((row, i) => ({
    index: i + 1,
    id: row.id,
    vendor: row.vendor,
    amount: row.amount.toString(),
    currency: row.currency,
    description: row.description,
    paymentMethod: row.cardLast4,
    date: row.date.toISOString().slice(0, 10),
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
  }));
}

export async function getTransactionByListIndex(userId: string, index: number, refDate = new Date()) {
  const list = await fetchListedTransactions(userId, refDate);
  return list.find((row) => row.index === index) ?? null;
}
