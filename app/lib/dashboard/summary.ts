import { prisma } from "@/app/lib/prisma";

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
};

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [budget, docSums, txAgg, todayTxSums, todayDocSums, categoryBreakdown, recentTx] = await Promise.all([
    prisma.budget.findUnique({
      where: { userId_month: { userId, month } },
      select: { expenseLimit: true, manualIncome: true },
    }),
    prisma.document.groupBy({
      by: ["type"],
      where: { userId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, date: { gte: start, lt: end } },
      _sum: { amount: true },
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
  ]);

  const incomeFromDocs = Number(docSums.find((s) => s.type === "payment_receipt")?._sum.amount ?? 0);
  const manualIncome = budget?.manualIncome != null ? Number(budget.manualIncome) : null;
  const effectiveIncome = manualIncome ?? incomeFromDocs;

  const expenseFromDocs = Number(docSums.find((s) => s.type === "expense")?._sum.amount ?? 0);
  const txExpense = Number(txAgg._sum?.amount ?? 0);
  const totalExpense = (expenseFromDocs + txExpense).toFixed(2);

  const income = effectiveIncome.toFixed(2);
  const net = (effectiveIncome - Number(totalExpense)).toFixed(2);

  const todayExpenseFromTx = Number(todayTxSums._sum.amount ?? 0);
  const todayExpenseFromDocs = Number(todayDocSums.find((s) => s.type === "expense")?._sum.amount ?? 0);
  const todayExpense = (todayExpenseFromTx + todayExpenseFromDocs).toFixed(2);

  const budgetLimit = budget?.expenseLimit ? budget.expenseLimit.toString() : "";
  const pct =
    budgetLimit && Number(budgetLimit) > 0
      ? Math.min(100, Math.round((Number(totalExpense) / Number(budgetLimit)) * 100))
      : 0;

  const catIds = categoryBreakdown.map((c) => c.categoryId).filter(Boolean) as string[];
  const categories = catIds.length > 0
    ? await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } })
    : [];
  const catNameMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const categoryBreakdownFormatted = categoryBreakdown
    .map((c) => ({
      category: (c.categoryId ? catNameMap[c.categoryId] : null) ?? "ללא קטגוריה",
      amount: Number(c._sum?.amount ?? 0),
    }))
    .filter((c) => c.amount > 0);

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
  };
}
