import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { MAX_CYCLE_START_DAY, getBudgetCycle, getUserCycleStartDay } from "@/app/lib/budget/cycle";

export const runtime = "nodejs";

const bodySchema = z.object({
  startDay: z.number().int().min(1).max(MAX_CYCLE_START_DAY),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startDay = await getUserCycleStartDay(user.id);
  return NextResponse.json({ startDay, label: getBudgetCycle(new Date(), startDay).label });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: `יום לא תקין (1–${MAX_CYCLE_START_DAY})` }, { status: 400 });
  }

  const { startDay } = parsed.data;
  await prisma.user.update({
    where: { id: user.id },
    data: { budgetCycleStartDay: startDay },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, startDay, label: getBudgetCycle(new Date(), startDay).label });
}
