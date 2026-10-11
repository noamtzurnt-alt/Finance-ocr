import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { getUserBudgetCycle } from "@/app/lib/budget/cycle";
import { parseWizardState, type WizardPersistedState } from "@/app/lib/budget/wizard-state";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  salary: z.number().min(0).max(10_000_000),
  other: z.number().min(0).max(10_000_000).optional(),
});

function emptyState(): WizardPersistedState {
  return {
    answers: {
      incomeSources: { steady: false, variable: false, other: false },
      salaryIncome: "",
      businessIncome: "",
      otherIncome: "",
      monthlySavings: "",
      expenseRows: [],
      businessExpenseRows: [],
    },
    step: 1,
    done: false,
  };
}

/**
 * Monthly income lives in the budget wizard, so the dashboard, budget screen and chat all read
 * the same number. Updating it also refreshes this month's spending limit (income − savings).
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
  }
  const salary = Math.round(parsed.data.salary);

  const [profile, cycle] = await Promise.all([
    prisma.financialProfile.findUnique({ where: { userId: user.id }, select: { wizardState: true } }),
    getUserBudgetCycle(user.id),
  ]);

  const state = parseWizardState(profile?.wizardState ?? null) ?? emptyState();
  const other = Math.round(parsed.data.other ?? Number(state.answers.otherIncome || 0));
  state.answers = {
    ...state.answers,
    incomeSources: { ...state.answers.incomeSources, steady: salary > 0, other: other > 0 },
    salaryIncome: salary > 0 ? String(salary) : "",
    otherIncome: other > 0 ? String(other) : "",
  };

  const savings = Number(state.answers.monthlySavings || 0) || 0;
  const expenseLimit = Math.max(0, salary + other - savings);
  const json = state as unknown as Prisma.InputJsonValue;

  await prisma.$transaction([
    prisma.financialProfile.upsert({
      where: { userId: user.id },
      update: { wizardState: json },
      create: { userId: user.id, wizardState: json },
    }),
    prisma.budget.upsert({
      where: { userId_month: { userId: user.id, month: cycle.month } },
      update: { manualIncome: null, ...(expenseLimit > 0 ? { expenseLimit: expenseLimit.toFixed(2) } : {}) },
      create: { userId: user.id, month: cycle.month, expenseLimit: expenseLimit.toFixed(2) },
    }),
  ]);

  return NextResponse.json({ ok: true, salary, other, expenseLimit });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { month } = await getUserBudgetCycle(user.id);

  await prisma.budget.updateMany({
    where: { userId: user.id, month },
    data: { manualIncome: null },
  });

  return NextResponse.json({ ok: true });
}
