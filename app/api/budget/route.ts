import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getUserBudgetCycle } from "@/app/lib/budget/cycle";

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  expenseLimit: z.string(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const n = Number(parsed.data.expenseLimit);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
    return NextResponse.json({ error: "Invalid expenseLimit" }, { status: 400 });
  }

  const month = parsed.data.month ?? (await getUserBudgetCycle(user.id)).month;
  const budget = await prisma.budget.upsert({
    where: { userId_month: { userId: user.id, month } },
    update: { expenseLimit: n.toFixed(2) },
    create: { userId: user.id, month, expenseLimit: n.toFixed(2) },
    select: { month: true, expenseLimit: true },
  });

  return NextResponse.json({ ok: true, budget });
}


