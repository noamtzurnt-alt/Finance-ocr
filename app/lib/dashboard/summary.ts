import { prisma } from "@/app/lib/prisma";
import { getDashboardBudgetCategoryNames } from "@/app/lib/dashboard/category-budgets";
import { getUserBudgetCycle, israelToday, utcDate } from "@/app/lib/budget/cycle";
import { getCycleBudget } from "@/app/lib/budget/cycle-budget";
import { getUpcomingCardCharge, type UpcomingCardCharge } from "@/app/lib/budget/card-charge";

export type CategoryBreakdownItem = { category: string; amount: number };
export type RecentTransactionItem = {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  categoryName: string | null;
};

export type DashboardSummary = {
  income: string;
  manualIncome: string | null;
  incomeFromDocs: string;
  expense: string;
  todayExpense: string;
  net: string;
  budgetLimit: string;
  pct: number;
  categoryBreakdown: CategoryBreakdownItem[];
  recentTransactions: RecentTransactionItem[];
  cycleLabel: string;
  cycleDayIndex: number;
  cycleTotalDays: number;
  cardCharge: UpcomingCardCharge;
  incomeParts: {
    salary: number;
    other: number;
    businessFromReceipts: number;
    manual: number | null;
  };
  budgetDetails: {
    limit: number | null;
    /** YYYY-MM the limit was saved for; differs from `month` when carried over. */
    limitMonth: string | null;
    month: string;
    savings: number;
    expenseFromTransactions: number;
    transactionCount: number;
    expenseFromDocs: number;
    /** Uncapped, can exceed 100. */
    rawPct: number;
    remaining: number | null;
    daysLeft: number;
  };
};

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const now = new Date();
  const cycle = await getUserBudgetCycle(userId, now);
  const { start, end, month } = cycle;
  const todayStart = israelToday(now);
  const todayEnd = utcDate(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), todayStart.getUTCDate() + 1);

  const [budget, docSums, txAgg, todayTxSums, todayDocSums, categoryBreakdown, recentTx, cardCharge] = await Promise.all([
    getCycleBudget(userId, month),
    prisma.document.groupBy({
      by: ["type"],
      where: { userId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, date: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, date: { gte: todayStart, lt: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.document.groupBy({
      by: ["type"],
      where: { userId, type: "expense", date: { gte: todayStart, lt: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, date: { gte: start, lt: end } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, date: true, vendor: true, amount: true, category: { select: { name: true } } },
    }),
    getUpcomingCardCharge(userId, now),
  ]);

  const incomeFromDocs = Number(docSums.find((s) => s.type === "payment_receipt")?._sum.amount ?? 0);
  const manualIncome = budget.manualIncome;
  const effectiveIncome = manualIncome ?? budget.plannedIncome + incomeFromDocs;

  const expenseFromDocs = Number(docSums.find((s) => s.type === "expense")?._sum.amount ?? 0);
  const txExpense = Number(txAgg._sum?.amount ?? 0);
  const totalExpense = (expenseFromDocs + txExpense).toFixed(2);

  const income = effectiveIncome.toFixed(2);
  const net = (effectiveIncome - Number(totalExpense)).toFixed(2);

  const todayExpenseFromTx = Number(todayTxSums._sum.amount ?? 0);
  const todayExpenseFromDocs = Number(todayDocSums.find((s) => s.type === "expense")?._sum.amount ?? 0);
  const todayExpense = (todayExpenseFromTx + todayExpenseFromDocs).toFixed(2);

  const budgetLimit = budget.expenseLimit ? budget.expenseLimit.toFixed(2) : "";
  const rawPct =
    budget.expenseLimit && budget.expenseLimit > 0
      ? Math.round((Number(totalExpense) / budget.expenseLimit) * 100)
      : 0;
  const pct = Math.min(100, rawPct);

  const catIds = categoryBreakdown.map((c) => c.categoryId).filter(Boolean) as string[];
  const [categories, budgetNames] = await Promise.all([
    catIds.length > 0
      ? prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    getDashboardBudgetCategoryNames(userId),
  ]);
  const catNameMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const merged = new Map<string, number>();
  for (const row of categoryBreakdown) {
    const amount = Number(row._sum?.amount ?? 0);
    if (amount <= 0) continue;
    const name = (row.categoryId ? catNameMap[row.categoryId] : null) ?? "ללא קטגוריה";
    const key = budgetNames.has(name) ? name : "אחר";
    merged.set(key, (merged.get(key) ?? 0) + amount);
  }
  const categoryBreakdownFormatted = [...merged.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const recentTransactions: RecentTransactionItem[] = recentTx.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    vendor: t.vendor,
    amount: Number(t.amount),
    categoryName: t.category?.name ?? null,
  }));

  return {
    income,
    manualIncome: manualIncome !== null ? manualIncome.toFixed(2) : null,
    incomeFromDocs: incomeFromDocs.toFixed(2),
    expense: totalExpense,
    todayExpense,
    net,
    budgetLimit,
    pct,
    categoryBreakdown: categoryBreakdownFormatted,
    recentTransactions,
    cycleLabel: cycle.label,
    cycleDayIndex: cycle.dayIndex,
    cycleTotalDays: cycle.totalDays,
    cardCharge,
    incomeParts: {
      salary: budget.salaryIncome,
      other: budget.otherIncome,
      businessFromReceipts: incomeFromDocs,
      manual: manualIncome,
    },
    budgetDetails: {
      limit: budget.expenseLimit,
      limitMonth: budget.limitMonth,
      month,
      savings: budget.monthlySavings,
      expenseFromTransactions: txExpense,
      transactionCount: txAgg._count._all,
      expenseFromDocs,
      rawPct,
      remaining: budget.expenseLimit ? budget.expenseLimit - Number(totalExpense) : null,
      daysLeft: Math.max(0, cycle.totalDays - cycle.dayIndex + 1),
    },
  };
}
