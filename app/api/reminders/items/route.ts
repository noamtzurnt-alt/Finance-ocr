import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { ownsList, ownsReminder, ownsSection, reminderFields, toReminderDto } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

const createSchema = z
  .object({ ...reminderFields, id: z.string().uuid() })
  .partial()
  .required({ listId: true, title: true });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  if (!(await ownsList(d.listId, user.id))) return NextResponse.json({ error: "List not found" }, { status: 404 });
  if (d.sectionId && !(await ownsSection(d.sectionId, user.id))) d.sectionId = null;
  if (d.parentId && !(await ownsReminder(d.parentId, user.id))) d.parentId = null;

  const { recurrence, ...rest } = d;
  const created = await prisma.reminder.create({
    data: {
      ...rest,
      userId: user.id,
      title: d.title.trim(),
      ...(recurrence !== undefined ? { recurrence: (recurrence ?? undefined) as Prisma.InputJsonValue | undefined } : {}),
    },
  });
  return NextResponse.json(toReminderDto(created));
}
