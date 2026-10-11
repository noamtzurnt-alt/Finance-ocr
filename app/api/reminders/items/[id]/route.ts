import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { ownsList, ownsReminder, ownsSection, reminderFields, toReminderDto } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    ...reminderFields,
    // true = soft delete (undo-able), false = restore.
    deleted: z.boolean(),
  })
  .partial();

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await ownsReminder(id, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { deleted, recurrence, ...d } = parsed.data;

  if (d.listId && !(await ownsList(d.listId, user.id))) return NextResponse.json({ error: "List not found" }, { status: 404 });
  if (d.sectionId && !(await ownsSection(d.sectionId, user.id))) d.sectionId = null;
  if (d.parentId && (d.parentId === id || !(await ownsReminder(d.parentId, user.id)))) d.parentId = null;

  const updated = await prisma.reminder.update({
    where: { id },
    data: {
      ...d,
      ...(d.title !== undefined ? { title: d.title.trim() } : {}),
      ...(recurrence !== undefined ? { recurrence: recurrence ?? Prisma.DbNull } : {}),
      ...(deleted !== undefined ? { deletedAt: deleted ? new Date() : null } : {}),
    },
  });

  // Subtasks follow their parent between lists and into/out of the bin.
  if (d.listId !== undefined || deleted !== undefined) {
    await prisma.reminder.updateMany({
      where: { parentId: id, userId: user.id },
      data: {
        ...(d.listId !== undefined ? { listId: d.listId, sectionId: d.sectionId ?? null } : {}),
        ...(deleted !== undefined ? { deletedAt: deleted ? new Date() : null } : {}),
      },
    });
  }

  return NextResponse.json(toReminderDto(updated));
}
