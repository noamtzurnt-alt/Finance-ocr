import { prisma } from "@/app/lib/prisma";
import { parseWizardState } from "@/app/lib/budget/wizard-state";
import { budgetCategoryNameSet, resolveBudgetCategoryLists } from "@/app/lib/categories/budget";

export async function getCategoryBudgets(userId: string): Promise<Record<string, number>> {
  const profile = await prisma.financialProfile.findUnique({
    where: { userId },
    select: { wizardState: true },
  });

  const state = parseWizardState(profile?.wizardState ?? null);
  if (!state) return {};

  const map: Record<string, number> = {};
  for (const row of state.answers.expenseRows) {
    const amt = Number(row.amount);
    if (row.label && amt > 0) map[row.label] = amt;
  }
  return map;
}

/** Names that belong on the dashboard budget chart — the saved budget plan, not every chat category. */
export async function getDashboardBudgetCategoryNames(userId: string): Promise<Set<string>> {
  const profile = await prisma.financialProfile.findUnique({
    where: { userId },
    select: { wizardState: true, personalCategories: true, businessCategories: true },
  });

  const state = parseWizardState(profile?.wizardState ?? null);
  const planned = [
    ...(state?.answers.expenseRows ?? []),
    ...(state?.answers.businessExpenseRows ?? []),
  ]
    .map((row) => row.label.trim())
    .filter(Boolean);

  if (planned.length > 0) return budgetCategoryNameSet(planned);

  const lists = resolveBudgetCategoryLists({
    personal: Array.isArray(profile?.personalCategories)
      ? profile.personalCategories.filter((name): name is string => typeof name === "string")
      : null,
    business: Array.isArray(profile?.businessCategories)
      ? profile.businessCategories.filter((name): name is string => typeof name === "string")
      : null,
  });
  return budgetCategoryNameSet([...lists.personal, ...lists.business]);
}
