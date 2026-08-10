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
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const daysRemaining = daysInMonth - daysElapsed + 1; // include today

  const [budget, docSums, fixedTxAgg, variableTxAgg, todayTxSums, todayDocSums, categoryBreakdown] = await Promise.all([
    prisma.budget.findUnique({
      where: { userId_month: { userId: user.id, month } },
      select: { expenseLimit: true, manualIncome: true },
    }),
    prisma.document.groupBy({
      by: ["type"],
      where: { userId: user.id, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    // Fixed expenses (isFixed = true)
    prisma.transaction.aggregate({
      where: { userId: user.id, date: { gte: start, lt: end }, isFixed: true },
      _sum: { amount: true },
    }),
    // Variable expenses (isFixed = false)
    prisma.transaction.aggregate({
      where: { userId: user.id, date: { gte: start, lt: end }, isFixed: false },
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
  const fixedTxExpense = Number(fixedTxAgg._sum?.amount ?? 0);
  const variableTxExpense = Number(variableTxAgg._sum?.amount ?? 0);
  const totalExpense = (expenseFromDocs + fixedTxExpense + variableTxExpense).toFixed(2);

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

  // DFSI Algorithm (Daily Financial Status Indicator)
  // If the user saved a budget from the wizard (expenseLimit), use it as source of truth:
  // variableCap = expenseLimit - fixedTxExpense.
  // Otherwise fall back to: disposableIncome = income - fixedTxExpense.
  const budgetFromWizard = !!(budget?.expenseLimit && Number(budget.expenseLimit) > 0);
  const disposableIncome = effectiveIncome - fixedTxExpense;
  const variableBudgetCap = budgetFromWizard
    ? Math.max(0, Number(budget!.expenseLimit) - fixedTxExpense)
    : disposableIncome;
  const dailyBudget = variableBudgetCap > 0 ? variableBudgetCap / daysInMonth : 0;
  const expectedVariableSpend = dailyBudget * daysElapsed;
  const spendingVelocity =
    expectedVariableSpend > 0 ? (variableTxExpense / expectedVariableSpend) * 100 : 0;

  // How much is safe to spend today (from today onward)
  const variableBudgetRemaining = variableBudgetCap - variableTxExpense;
  const safeToSpendToday = daysRemaining > 0 ? variableBudgetRemaining / daysRemaining : 0;

  // Status based on spending velocity
  let dfsiStatus: "excellent" | "on_track" | "warning" | "over";
  if (spendingVelocity < 80) dfsiStatus = "excellent";
  else if (spendingVelocity < 100) dfsiStatus = "on_track";
  else if (spendingVelocity < 130) dfsiStatus = "warning";
  else dfsiStatus = "over";

  // Nudge message
  let nudge = "";
  const velPct = Math.round(spendingVelocity);
  if (effectiveIncome === 0 && !budgetFromWizard) {
    nudge = "הכנס הכנסה חודשית כדי לקבל תמונת מצב מדויקת";
  } else if (dfsiStatus === "excellent") {
    nudge = `מעולה! הוצאת ${velPct}% מהצפוי עד היום — אתה ${100 - velPct}% מתחת לקצב`;
  } else if (dfsiStatus === "on_track") {
    nudge = `במסלול. מותר לך להוציא עוד ${safeToSpendToday > 0 ? safeToSpendToday.toFixed(0) : "0"} ₪ היום`;
  } else if (dfsiStatus === "warning") {
    nudge = `קצב ההוצאות גבוה מהצפוי — שקול להאט ל-${daysRemaining} הימים הנותרים`;
  } else {
    nudge = `חריגה! הוצאת ${velPct}% מהתקציב היומי הצפוי — בדוק הוצאות לא הכרחיות`;
  }

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
    // DFSI data
    dfsi: {
      status: dfsiStatus,
      spendingVelocity: Math.round(spendingVelocity),
      dailyBudget: dailyBudget.toFixed(2),
      safeToSpendToday: Math.max(0, safeToSpendToday).toFixed(2),
      variableExpenses: variableTxExpense.toFixed(2),
      fixedExpenses: fixedTxExpense.toFixed(2),
      disposableIncome: disposableIncome.toFixed(2),
      expectedVariableSpend: Math.round(expectedVariableSpend).toString(),
      daysElapsed,
      daysInMonth,
      daysRemaining,
      nudge,
      hasIncome: effectiveIncome > 0 || budgetFromWizard,
      budgetFromWizard,
    },
  });
}
