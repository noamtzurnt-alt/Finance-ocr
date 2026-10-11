import { prisma } from "@/app/lib/prisma";
import { syncBudgetCategoriesForUser } from "@/app/lib/categories/budget";
import { getTransactionsList } from "@/app/lib/transactions/list";
import { getUserBudgetCycle } from "@/app/lib/budget/cycle";
import TransactionsClient from "./TransactionsClient";

const ensuredUsers = new Set<string>();

function parseCategoryJson(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export default async function TransactionsContent(props: { userId: string }) {
  if (!ensuredUsers.has(props.userId)) {
    const profile = await prisma.financialProfile.findUnique({
      where: { userId: props.userId },
      select: { personalCategories: true, businessCategories: true },
    });

    await syncBudgetCategoriesForUser(props.userId, {
      personal: parseCategoryJson(profile?.personalCategories),
      business: parseCategoryJson(profile?.businessCategories),
    });

    ensuredUsers.add(props.userId);
  }

  const cycle = await getUserBudgetCycle(props.userId);
  const initialYear = cycle.start.getUTCFullYear();
  const initialMonth = cycle.start.getUTCMonth() + 1;

  const [categories, initialItems] = await Promise.all([
    prisma.category.findMany({
      where: { userId: props.userId, budgetScope: { not: null } },
      orderBy: [{ budgetScope: "asc" }, { name: "asc" }],
      select: { id: true, name: true, budgetScope: true },
    }),
    getTransactionsList(props.userId, {
      limit: 200,
      year: initialYear,
      month: initialMonth,
      cycleStartDay: cycle.startDay,
    }),
  ]);

  const scopedCategories = categories.filter(
    (c): c is { id: string; name: string; budgetScope: "personal" | "business" } =>
      c.budgetScope === "personal" || c.budgetScope === "business",
  );

  return (
    <TransactionsClient
      categories={scopedCategories}
      initialItems={initialItems}
      initialYear={initialYear}
      initialMonth={initialMonth}
      cycleStartDay={cycle.startDay}
    />
  );
}
