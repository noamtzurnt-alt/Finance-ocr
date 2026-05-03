import { prisma } from "@/app/lib/prisma";
import TransactionsClient from "./TransactionsClient";

const DEFAULT_CATEGORIES = ["כללי", "אוכל", "רכב/דלק", "תוכנות/מנויים", "בגדים"];

const ensuredUsers = new Set<string>();

async function ensureDefaultCategories(userId: string) {
  if (ensuredUsers.has(userId)) return;
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
  // Only fetch categories server-side (tiny query, needed for the form immediately).
  // Transactions themselves are fetched client-side via the API after page load.
  await ensureDefaultCategories(props.userId);

  const categories = await prisma.category.findMany({
    where: { userId: props.userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="card p-4">
      <TransactionsClient categories={categories} />
    </div>
  );
}
