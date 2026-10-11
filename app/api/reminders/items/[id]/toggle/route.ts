import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { setReminderCompleted } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = z.object({ completed: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const result = await setReminderCompleted(user.id, id, parsed.data.completed);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
