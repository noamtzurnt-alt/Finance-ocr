import { prisma } from "@/app/lib/prisma";
import { HEBREW_MONTHS, parseMonthKey } from "@/app/lib/budget/months";

/** Capped at 28 so every month has the start day. */
export const MAX_CYCLE_START_DAY = 28;

export type BudgetCycle = {
  startDay: number;
  /** Inclusive. */
  start: Date;
  /** Exclusive. */
  end: Date;
  /** YYYY-MM of the month the cycle starts in; key for Budget rows. */
  month: string;
  /** e.g. "אוקטובר 2026" or "אוקטובר 2026 (10.10–9.11)". */
  label: string;
  dayIndex: number;
  totalDays: number;
};

export function normalizeCycleStartDay(value: unknown): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_CYCLE_START_DAY);
}

export const APP_TIME_ZONE = "Asia/Jerusalem";

/**
 * Today's calendar date in Israel as UTC midnight — the form Prisma uses for `@db.Date`.
 * Servers run in UTC, so `new Date()` alone is the previous day between 00:00–03:00 Israel time.
 */
export function israelToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

export function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

/** Keeps the numeric range in left-to-right order inside Hebrew text. */
function cycleLabel(start: Date, lastDay: Date, day: number): string {
  const base = `${HEBREW_MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  if (day === 1) return base;
  const range = `${start.getUTCDate()}.${start.getUTCMonth() + 1}–${lastDay.getUTCDate()}.${lastDay.getUTCMonth() + 1}`;
  return `${base} (\u2066${range}\u2069)`;
}

export function getBudgetCycle(refDate = new Date(), startDay = 1): BudgetCycle {
  const day = normalizeCycleStartDay(startDay);
  const today = israelToday(refDate);
  const monthOffset = today.getUTCDate() < day ? -1 : 0;
  const start = utcDate(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, day);
  const end = utcDate(start.getUTCFullYear(), start.getUTCMonth() + 1, day);
  const lastDay = utcDate(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 1);

  const month = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  const label = cycleLabel(start, lastDay, day);

  const msPerDay = 24 * 60 * 60 * 1000;
  const dayIndex = Math.round((today.getTime() - start.getTime()) / msPerDay) + 1;
  const totalDays = Math.round((end.getTime() - start.getTime()) / msPerDay);

  return { startDay: day, start, end, month, label, dayIndex, totalDays };
}

/** Cycle for a YYYY-MM key. Future months and invalid keys return null. A past month is treated as complete. */
export function getBudgetCycleForMonth(month: string, startDay = 1, now = new Date()): BudgetCycle | null {
  const parsed = parseMonthKey(month);
  if (!parsed) return null;

  const current = getBudgetCycle(now, startDay);
  if (month > current.month) return null;
  if (month === current.month) return current;

  const day = normalizeCycleStartDay(startDay);
  const start = utcDate(parsed.year, parsed.monthIndex, day);
  const end = utcDate(start.getUTCFullYear(), start.getUTCMonth() + 1, day);
  const lastDay = utcDate(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 1);

  const label = cycleLabel(start, lastDay, day);

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((end.getTime() - start.getTime()) / msPerDay);

  return {
    startDay: day,
    start,
    end,
    month,
    label,
    dayIndex: totalDays,
    totalDays,
  };
}

export async function getUserCycleStartDay(userId: string): Promise<number> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { budgetCycleStartDay: true },
  });
  return normalizeCycleStartDay(row?.budgetCycleStartDay ?? 1);
}

export async function getUserBudgetCycle(userId: string, refDate = new Date()): Promise<BudgetCycle> {
  return getBudgetCycle(refDate, await getUserCycleStartDay(userId));
}
