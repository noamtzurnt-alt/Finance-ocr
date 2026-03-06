import { prisma } from "@/app/lib/prisma";
import TransactionsClient from "./TransactionsClient";

export default async function TransactionsContent(props: { userId: string }) {
  const [categories, items] = await Promise.all([
    prisma.category.findMany({
      where: { userId: props.userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { userId: props.userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100_000,
      include: { category: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="card p-4">
      <TransactionsClient
        categories={categories}
        initial={items.map((t) => ({
          id: t.id,
          date: t.date.toISOString().slice(0, 10),
          amount: t.amount.toString(),
          currency: t.currency,
          vendor: t.vendor,
          description: t.description,
          categoryId: t.categoryId,
          categoryName: t.category?.name ?? null,
          cardLast4: t.cardLast4,
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}

