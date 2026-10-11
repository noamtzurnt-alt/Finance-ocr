import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { todayIso } from "@/app/lib/reminders/dates";
import { isValidRecurrence, nextOccurrence } from "@/app/lib/reminders/recurrence";
import type {
  Recurrence,
  ReminderDto,
  ReminderListDto,
  ReminderSectionDto,
  RemindersData,
} from "@/app/lib/reminders/types";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

type ReminderRow = Prisma.ReminderGetPayload<object>;
type ListRow = Prisma.ReminderListGetPayload<object>;

export function toReminderDto(r: ReminderRow): ReminderDto {
  return {
    id: r.id,
    listId: r.listId,
    sectionId: r.sectionId,
    parentId: r.parentId,
    title: r.title,
    notes: r.notes,
    url: r.url,
    dueDate: r.dueDate,
    dueTime: r.dueTime,
    earlyMinutes: r.earlyMinutes,
    recurrence: isValidRecurrence(r.recurrence) ? (r.recurrence as Recurrence) : null,
    priority: r.priority,
    flagged: r.flagged,
    tags: r.tags,
    completed: r.completed,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    position: r.position,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toListDto(l: ListRow): ReminderListDto {
  return {
    id: l.id,
    name: l.name,
    color: l.color,
    icon: l.icon,
    kind: l.kind === "groceries" ? "groceries" : "standard",
    sortMode: (["manual", "due", "priority", "created", "title"].includes(l.sortMode) ? l.sortMode : "manual") as ReminderListDto["sortMode"],
    showCompleted: l.showCompleted,
    viewMode: l.viewMode === "columns" ? "columns" : "list",
    position: l.position,
  };
}

export function toSectionDto(s: { id: string; listId: string; name: string; position: number }): ReminderSectionDto {
  return { id: s.id, listId: s.listId, name: s.name, position: s.position };
}

export async function loadReminders(userId: string): Promise<RemindersData> {
  // Soft-deleted rows only exist so "undo" can bring them back.
  await prisma.reminder.deleteMany({
    where: { userId, deletedAt: { lt: new Date(Date.now() - UNDO_WINDOW_MS) } },
  });

  let lists = await prisma.reminderList.findMany({ where: { userId }, orderBy: { position: "asc" } });
  if (lists.length === 0) {
    lists = [await prisma.reminderList.create({ data: { userId, name: "תזכורות", color: "blue", icon: "list" } })];
  }
  const [sections, reminders] = await Promise.all([
    prisma.reminderSection.findMany({ where: { userId }, orderBy: { position: "asc" } }),
    prisma.reminder.findMany({ where: { userId, deletedAt: null }, orderBy: { position: "asc" } }),
  ]);
  return {
    lists: lists.map(toListDto),
    sections: sections.map(toSectionDto),
    reminders: reminders.map(toReminderDto),
  };
}

export async function ownsList(listId: string, userId: string) {
  return Boolean(await prisma.reminderList.findFirst({ where: { id: listId, userId }, select: { id: true } }));
}

export async function ownsSection(sectionId: string, userId: string) {
  return Boolean(await prisma.reminderSection.findFirst({ where: { id: sectionId, userId }, select: { id: true } }));
}

export async function ownsReminder(id: string, userId: string) {
  return Boolean(await prisma.reminder.findFirst({ where: { id, userId }, select: { id: true } }));
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;

export const recurrenceSchema = z
  .object({
    freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().min(1).max(365),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    monthWeek: z.object({ nth: z.number().int().min(-1).max(5), weekday: z.number().int().min(0).max(6) }).optional(),
    until: z.string().regex(dateRe).nullable().optional(),
    count: z.number().int().min(1).max(1000).nullable().optional(),
    done: z.number().int().min(0).optional(),
  })
  .nullable();

export const reminderFields = {
  listId: z.string().max(64),
  sectionId: z.string().max(64).nullable(),
  parentId: z.string().max(64).nullable(),
  title: z.string().max(500),
  notes: z.string().max(20_000),
  url: z.string().max(2000),
  dueDate: z.string().regex(dateRe).nullable(),
  dueTime: z.string().regex(timeRe).nullable(),
  earlyMinutes: z.number().int().min(0).max(60 * 24 * 30).nullable(),
  recurrence: recurrenceSchema,
  priority: z.number().int().min(0).max(3),
  flagged: z.boolean(),
  tags: z.array(z.string().min(1).max(60)).max(30),
  position: z.number(),
};

export const listFields = {
  name: z.string().trim().min(1).max(80),
  color: z.string().max(20),
  icon: z.string().max(30),
  kind: z.enum(["standard", "groceries"]),
  sortMode: z.enum(["manual", "due", "priority", "created", "title"]),
  showCompleted: z.boolean(),
  viewMode: z.enum(["list", "columns"]),
  position: z.number(),
};

/**
 * Completing a repeating reminder moves it to its next date instead of closing it
 * (also when completed early), until the series ends.
 */
export async function setReminderCompleted(userId: string, id: string, completed: boolean) {
  const r = await prisma.reminder.findFirst({ where: { id, userId } });
  if (!r) return null;

  if (completed && isValidRecurrence(r.recurrence)) {
    const rule = r.recurrence;
    const next = nextOccurrence(r.dueDate ?? todayIso(), rule);
    if (next) {
      const updated = await prisma.reminder.update({
        where: { id },
        data: {
          dueDate: next,
          completed: false,
          completedAt: null,
          recurrence: { ...rule, done: (rule.done ?? 0) + 1 } as Prisma.InputJsonValue,
        },
      });
      await prisma.reminder.updateMany({ where: { parentId: id }, data: { completed: false, completedAt: null } });
      return { reminder: toReminderDto(updated), advanced: true };
    }
  }

  const updated = await prisma.reminder.update({
    where: { id },
    data: { completed, completedAt: completed ? new Date() : null },
  });
  return { reminder: toReminderDto(updated), advanced: false };
}
