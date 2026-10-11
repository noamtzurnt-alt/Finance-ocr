import { prisma } from "@/app/lib/prisma";
import { parseWizardState } from "@/app/lib/budget/wizard-state";

export type CycleBudget = {
  /** Limit for this month, or the most recent earlier one if none was saved. */
  expenseLimit: number | null;
  /** YYYY-MM the limit was saved for (differs from the requested month when carried over). */
  limitMonth: string | null;
  /** Only set when entered by hand for this exact month. */
  manualIncome: number | null;
  /** Salary from the budget wizard; arrives at cycle start. */
  salaryIncome: number;
  /** Other personal income from the budget wizard. */
  otherIncome: number;
  /** salaryIncome + otherIncome */
  plannedIncome: number;
  monthlySavings: number;
};

function money(value: string | undefined): number {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function getCycleBudget(userId: string, month: string): Promise<CycleBudget> {
  const [exact, latest, profile] = await Promise.all([
    prisma.budget.findUnique({
      where: { userId_month: { userId, month } },
      select: { expenseLimit: true, manualIncome: true },
    }),
    prisma.budget.findFirst({
      where: { userId, month: { lte: month }, expenseLimit: { gt: 0 } },
      orderBy: { month: "desc" },
      select: { expenseLimit: true, month: true },
    }),
    prisma.financialProfile.findUnique({
      where: { userId },
      select: { wizardState: true },
    }),
  ]);

  const answers = parseWizardState(profile?.wizardState ?? null)?.answers;
  const salaryIncome = answers?.incomeSources.steady ? money(answers.salaryIncome) : 0;
  const otherIncome = answers?.incomeSources.other ? money(answers.otherIncome) : 0;

  const exactLimit = exact?.expenseLimit != null ? Number(exact.expenseLimit) : 0;
  const latestLimit = latest?.expenseLimit != null ? Number(latest.expenseLimit) : 0;
  const expenseLimit = exactLimit > 0 ? exactLimit : latestLimit > 0 ? latestLimit : null;
  const limitMonth = exactLimit > 0 ? month : latestLimit > 0 ? (latest?.month ?? null) : null;

  return {
    expenseLimit,
    limitMonth,
    manualIncome: exact?.manualIncome != null ? Number(exact.manualIncome) : null,
    salaryIncome,
    otherIncome,
    plannedIncome: salaryIncome + otherIncome,
    monthlySavings: money(answers?.monthlySavings),
  };
}
