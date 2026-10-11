import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { DEFAULT_TZ, localNow } from "@/app/lib/reminders/push";
import { setReminderCompleted } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

const SNOOZE_MS = 60 * 60 * 1000;

/** Buttons on the notification itself (Android / desktop; iOS shows none). */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z
    .object({ id: z.string().min(1).max(64), action: z.enum(["complete", "snooze"]) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { id, action } = parsed.data;

  if (action === "complete") {
    const res = await setReminderCompleted(user.id, id, true);
    if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const sub = await prisma.pushSubscription.findFirst({
    where: { userId: user.id },
    orderBy: { lastUsedAt: "desc" },
    select: { timeZone: true },
  });
  const later = localNow(sub?.timeZone ?? DEFAULT_TZ, Date.now() + SNOOZE_MS);
  const res = await prisma.reminder.updateMany({
    where: { id, userId: user.id, deletedAt: null },
    data: { dueDate: later.date, dueTime: later.time },
  });
  if (!res.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
