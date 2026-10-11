import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { parseWizardState } from "@/app/lib/budget/wizard-state";
import { formatChatFailure } from "@/app/lib/transactions/parse-quick";
import { getUserBudgetCycle } from "@/app/lib/budget/cycle";
import { getCycleBudget } from "@/app/lib/budget/cycle-budget";

export const runtime = "nodejs";

function money(n: number) {
  return `${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })} ₪`;
}

function percent(spent: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.round((spent / limit) * 100);
}

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reply: formatChatFailure("צריך להתחבר מחדש.") },
      { status: 401 },
    );
  }

  try {
    const { month, start, end, label } = await getUserBudgetCycle(user.id);
    const [budget, profile, txAgg, txByCategory] = await Promise.all([
      getCycleBudget(user.id, month),
      prisma.financialProfile.findUnique({
        where: { userId: user.id },
        select: { wizardState: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, date: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId: user.id, date: { gte: start, lt: end } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
    ]);

    const state = parseWizardState(profile?.wizardState ?? null);
    const limit = budget.expenseLimit ?? 0;
    if (!state || !state.done || limit <= 0) {
      return NextResponse.json({
        ok: true,
        reply: "עדיין לא נבנה תקציב שמור. כנס למסך תקציב, שמור תקציב חודשי ואז יהיה אפשר לראות כאן את כל החלוקה.",
      });
    }

    const salaryIncome = Number(state.answers.salaryIncome || 0);
    const businessIncome = Number(state.answers.businessIncome || 0);
    const otherIncome = Number(state.answers.otherIncome || 0);
    const monthlySavings = Number(state.answers.monthlySavings || 0);
    const spent = Number(txAgg._sum.amount ?? 0);
    const remaining = limit - spent;
    const pct = percent(spent, limit);

    const personalRows = state.answers.expenseRows
      .map((row) => ({ name: row.label.trim(), amount: Number(row.amount || 0) }))
      .filter((row) => row.name);
    const businessRows = state.answers.businessExpenseRows
      .map((row) => ({
        name: row.label.trim(),
        amount: Number(row.amount || 0),
        notes: row.notes?.trim() || null,
      }))
      .filter((row) => row.name);

    const personalPlanned = personalRows.reduce((sum, row) => sum + row.amount, 0);
    const businessPlanned = businessRows.reduce((sum, row) => sum + row.amount, 0);
    const plannedByName = new Map(personalRows.map((row) => [row.name, row.amount]));

    const catIds = txByCategory.map((row) => row.categoryId).filter(Boolean) as string[];
    const categories = catIds.length
      ? await prisma.category.findMany({
          where: { userId: user.id, id: { in: catIds } },
          select: { id: true, name: true },
        })
      : [];
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const topLines = txByCategory
      .map((row) => {
        const name = (row.categoryId ? categoryNameById.get(row.categoryId) : null) ?? "ללא קטגוריה";
        const actual = Number(row._sum.amount ?? 0);
        const planned = plannedByName.get(name) ?? 0;
        const delta = planned - actual;
        const status =
          planned <= 0 ? "ללא יעד" : delta >= 0 ? `נשארו ${money(delta)}` : `חריגה של ${money(Math.abs(delta))}`;
        return { name, actual, planned, status };
      })
      .filter((row) => row.actual > 0)
      .slice(0, 5);

    const lines = [
      `התקציב שלך - ${label}`,
      remaining >= 0
        ? `מצב נוכחי: אתה בתוך התקציב ונשארו ${money(remaining)}.`
        : `מצב נוכחי: יש חריגה של ${money(Math.abs(remaining))}.`,
      `הוצאת עד עכשיו ${money(spent)} מתוך יעד של ${money(limit)} (${pct}%).`,
      "",
      "תכנון התקציב:",
      `יעד הוצאות אישי לחודש: ${money(limit)}`,
      `הכנסה אישית: ${money(salaryIncome + otherIncome)}`,
      businessIncome > 0 ? `הכנסה עסקית: ${money(businessIncome)}` : null,
      monthlySavings > 0 ? `חיסכון חודשי: ${money(monthlySavings)}` : null,
      "",
      "חלוקה אישית:",
      ...personalRows.map((row) => `- ${row.name}: ${money(row.amount)}`),
      `סה״כ אישי: ${money(personalPlanned)}`,
      businessRows.length > 0 ? "" : null,
      businessRows.length > 0 ? "חלוקה עסקית:" : null,
      ...businessRows.map((row) =>
        `- ${row.name}: ${money(row.amount)}${row.notes ? ` · ${row.notes}` : ""}`,
      ),
      businessRows.length > 0 ? `סה״כ עסקי: ${money(businessPlanned)}` : null,
      topLines.length > 0 ? "" : null,
      topLines.length > 0 ? "עמידה בפועל בקטגוריות מובילות:" : null,
      ...topLines.map((row) =>
        `- ${row.name}: הוצאת ${money(row.actual)}${row.planned > 0 ? ` מתוך ${money(row.planned)}` : ""} · ${row.status}`,
      ),
    ].filter(Boolean);

    return NextResponse.json({ ok: true, reply: lines.join("\n") });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאת שרת לא ידועה";
    return NextResponse.json(
      { ok: false, reply: formatChatFailure(`שגיאה בשליפת התקציב: ${msg}`) },
      { status: 500 },
    );
  }
}
