import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { ownsList } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await ownsList(id, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const res = await prisma.reminder.updateMany({
    where: { userId: user.id, listId: id, completed: true, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true, count: res.count });
}
