import { prisma } from "@/app/lib/prisma";
import { parseWizardState } from "@/app/lib/budget/wizard-state";

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
