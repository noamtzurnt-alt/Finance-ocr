import { prisma } from "@/app/lib/prisma";
import {
  CHAT_LIST_LIMIT,
  getCurrentMonthRange,
  type ListedTransaction,
} from "@/app/lib/transactions/chat-list";

export async function fetchListedTransactions(
  userId: string,
  refDate = new Date(),
): Promise<ListedTransaction[]> {
  const { start, end } = getCurrentMonthRange(refDate);
  const rows = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: CHAT_LIST_LIMIT,
    select: {
      id: true,
      vendor: true,
      amount: true,
      currency: true,
      description: true,
      cardLast4: true,
      date: true,
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
  }));
}

export async function getTransactionByListIndex(userId: string, index: number, refDate = new Date()) {
  const list = await fetchListedTransactions(userId, refDate);
  return list.find((row) => row.index === index) ?? null;
}
