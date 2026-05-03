import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { amount: string };
  const amount = parseFloat(body.amount);
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.budget.upsert({
    where: { userId_month: { userId: user.id, month } },
    update: { manualIncome: amount },
    create: { userId: user.id, month, expenseLimit: 0, manualIncome: amount },
  });

  return NextResponse.json({ ok: true, amount: amount.toFixed(2) });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.budget.updateMany({
    where: { userId: user.id, month },
    data: { manualIncome: null },
  });

  return NextResponse.json({ ok: true });
}
