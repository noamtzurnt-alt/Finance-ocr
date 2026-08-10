import { prisma } from "@/app/lib/prisma";
import { syncBudgetCategoriesForUser } from "@/app/lib/categories/budget";
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

  const categories = await prisma.category.findMany({
    where: { userId: props.userId, budgetScope: { not: null } },
    orderBy: [{ budgetScope: "asc" }, { name: "asc" }],
    select: { id: true, name: true, budgetScope: true },
  });

  const scopedCategories = categories.filter(
    (c): c is { id: string; name: string; budgetScope: "personal" | "business" } =>
      c.budgetScope === "personal" || c.budgetScope === "business",
  );

  return (
    <div className="card p-4">
      <TransactionsClient categories={scopedCategories} />
    </div>
  );
}
