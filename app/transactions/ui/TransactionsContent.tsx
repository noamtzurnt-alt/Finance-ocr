import { prisma } from "@/app/lib/prisma";
import TransactionsClient from "./TransactionsClient";

const DEFAULT_CATEGORIES = ["כללי", "אוכל", "רכב/דלק", "תוכנות/מנויים", "בגדים"];

// Remember which users already have default categories (within this server instance lifetime)
const ensuredUsers = new Set<string>();

async function ensureDefaultCategories(userId: string) {
  if (ensuredUsers.has(userId)) return; // already done this instance
  const exists = await prisma.category.findFirst({ where: { userId, name: "כללי" }, select: { id: true } });
  if (!exists) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((name) => ({ userId, name })),
      skipDuplicates: true,
    });
  }
  ensuredUsers.add(userId);
}

export default async function TransactionsContent(props: { userId: string }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Run in parallel: ensure defaults + fetch categories + fetch current-month transactions
  const [, categories, items] = await Promise.all([
    ensureDefaultCategories(props.userId),
    prisma.category.findMany({
      where: { userId: props.userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { userId: props.userId, date: { gte: start, lt: end } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 2_000,
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

