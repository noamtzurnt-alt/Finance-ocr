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
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [budget, recentTx, docSums, txSums] = await Promise.all([
    prisma.budget.findUnique({
      where: { userId_month: { userId: user.id, month } },
      select: { expenseLimit: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: { id: true, date: true, amount: true, currency: true, vendor: true, description: true, cardLast4: true },
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
  ]);

  const incomeFromDocs = Number(docSums.find((s) => s.type === "income")?._sum.amount ?? 0);
  const expenseFromDocs = Number(docSums.find((s) => s.type === "expense")?._sum.amount ?? 0);
  const expenseFromTx = Number(txSums._sum.amount ?? 0);
  const totalExpense = (expenseFromDocs + expenseFromTx).toFixed(2);
  const income = incomeFromDocs.toFixed(2);
  const net = (incomeFromDocs - expenseFromDocs - expenseFromTx).toFixed(2);
  const budgetLimit = budget?.expenseLimit?.toString() ?? "";
  const pct =
    budgetLimit && Number(budgetLimit) > 0
      ? Math.min(100, Math.round((Number(totalExpense) / Number(budgetLimit)) * 100))
      : 0;

  return NextResponse.json({
    income,
    expense: totalExpense,
    net,
    budgetLimit,
    pct,
    recentTx: recentTx.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      amount: t.amount.toString(),
      currency: t.currency,
      vendor: t.vendor,
      description: t.description,
      cardLast4: t.cardLast4,
    })),
  });
}
