import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [budget, docSums, txAgg, todayTxSums, todayDocSums, categoryBreakdown] = await Promise.all([
    prisma.budget.findUnique({
      where: { userId_month: { userId: user.id, month } },
      select: { expenseLimit: true, manualIncome: true },
    }),
    prisma.document.groupBy({
      by: ["type"],
      where: { userId: user.id, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, date: { gte: todayStart, lt: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.document.groupBy({
      by: ["type"],
      where: { userId: user.id, type: "expense", date: { gte: todayStart, lt: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId: user.id, date: { gte: start, lt: end } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
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

  // Resolve categoryId → name
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

  return NextResponse.json({
    income,
    manualIncome: manualIncome !== null ? manualIncome.toFixed(2) : null,
    incomeFromDocs: incomeFromDocs.toFixed(2),
    expense: totalExpense,
    todayExpense,
    net,
    budgetLimit,
    pct,
    categoryBreakdown: categoryBreakdownFormatted,
  });
}
