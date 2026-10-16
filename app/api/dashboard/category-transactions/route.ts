import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getDashboardBudgetCategoryNames } from "@/app/lib/dashboard/category-budgets";
import { getBudgetCycleForMonth, getUserBudgetCycle, getUserCycleStartDay } from "@/app/lib/budget/cycle";
import { parseMonthKey } from "@/app/lib/budget/months";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const category = (url.searchParams.get("category") ?? "").trim();
  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const month = url.searchParams.get("month");
  let range: { start: Date; end: Date };
  if (month) {
    if (!parseMonthKey(month)) {
      return NextResponse.json({ error: "חודש לא תקין" }, { status: 400 });
    }
    const cycle = getBudgetCycleForMonth(month, await getUserCycleStartDay(user.id));
    if (!cycle) return NextResponse.json({ error: "חודש לא תקין" }, { status: 400 });
    range = cycle;
  } else {
    range = await getUserBudgetCycle(user.id);
  }
  const { start, end } = range;

  const budgetNames = category === "אחר" ? await getDashboardBudgetCategoryNames(user.id) : null;
  const items = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lt: end },
      ...(budgetNames
        ? {
            OR: [
              { categoryId: null },
              { category: { name: { notIn: [...budgetNames] } } },
            ],
          }
        : { category: { name: category } }),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      date: true,
      vendor: true,
      description: true,
      amount: true,
      cardLast4: true,
    },
  });

  return NextResponse.json({
    category,
    items: items.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      vendor: t.vendor,
      description: t.description,
      amount: Number(t.amount),
      cardLast4: t.cardLast4,
    })),
  });
}
