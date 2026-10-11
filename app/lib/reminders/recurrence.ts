import { addDays, fromIso, toIso, WEEKDAYS, WEEKDAYS_SHORT } from "@/app/lib/reminders/dates";
import type { Recurrence } from "@/app/lib/reminders/types";

function nthWeekdayOfMonth(year: number, month: number, nth: number, weekday: number): Date | null {
  if (nth === -1) {
    const last = new Date(year, month + 1, 0);
    last.setDate(last.getDate() - ((last.getDay() - weekday + 7) % 7));
    return last;
  }
  const first = new Date(year, month, 1);
  const day = 1 + ((weekday - first.getDay() + 7) % 7) + (nth - 1) * 7;
  const d = new Date(year, month, day);
  return d.getMonth() === month ? d : null;
}

function addMonthsClamped(d: Date, n: number, dayOfMonth: number) {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(dayOfMonth, lastDay));
  return target;
}

/** The next due date after `from`, or null when the series has ended. */
export function nextOccurrence(from: string, rule: Recurrence): string | null {
  const interval = Math.max(1, rule.interval || 1);
  const done = (rule.done ?? 0) + 1;
  if (rule.count && done >= rule.count) return null;

  let next: string | null = null;
  const base = fromIso(from);

  if (rule.freq === "daily") {
    next = addDays(from, interval);
  } else if (rule.freq === "weekly") {
    const days = rule.weekdays?.length ? [...rule.weekdays].sort((a, b) => a - b) : [base.getDay()];
    const later = days.find((d) => d > base.getDay());
    if (later !== undefined) next = addDays(from, later - base.getDay());
    else next = addDays(from, 7 * interval - base.getDay() + days[0]);
  } else if (rule.freq === "monthly") {
    if (rule.monthWeek) {
      for (let k = interval; k <= interval * 24 && !next; k += interval) {
        const m = new Date(base.getFullYear(), base.getMonth() + k, 1);
        const d = nthWeekdayOfMonth(m.getFullYear(), m.getMonth(), rule.monthWeek.nth, rule.monthWeek.weekday);
        if (d) next = toIso(d);
      }
    } else {
      next = toIso(addMonthsClamped(base, interval, base.getDate()));
    }
  } else {
    next = toIso(addMonthsClamped(base, 12 * interval, base.getDate()));
  }

  if (next && rule.until && next > rule.until) return null;
  return next;
}

const NTH = { 1: "הראשון", 2: "השני", 3: "השלישי", 4: "הרביעי", [-1]: "האחרון" } as Record<number, string>;

export function describeRecurrence(rule: Recurrence | null): string {
  if (!rule) return "אף פעם";
  const n = Math.max(1, rule.interval || 1);
  let text: string;
  if (rule.freq === "daily") text = n === 1 ? "כל יום" : `כל ${n} ימים`;
  else if (rule.freq === "weekly") {
    const days = rule.weekdays?.length ? ` (${[...rule.weekdays].sort().map((d) => WEEKDAYS_SHORT[d]).join(" ")})` : "";
    text = (n === 1 ? "כל שבוע" : n === 2 ? "כל שבועיים" : `כל ${n} שבועות`) + days;
  } else if (rule.freq === "monthly") {
    text = n === 1 ? "כל חודש" : n === 2 ? "כל חודשיים" : `כל ${n} חודשים`;
    if (rule.monthWeek) text += `, ביום ${WEEKDAYS[rule.monthWeek.weekday]} ${NTH[rule.monthWeek.nth] ?? ""}`;
  } else text = n === 1 ? "כל שנה" : `כל ${n} שנים`;
  if (rule.until) text += ` עד ${rule.until.split("-").reverse().join(".")}`;
  else if (rule.count) text += `, ${rule.count} פעמים`;
  return text;
}

export function isValidRecurrence(v: unknown): v is Recurrence {
  if (!v || typeof v !== "object") return false;
  const r = v as Recurrence;
  return ["daily", "weekly", "monthly", "yearly"].includes(r.freq) && Number.isFinite(r.interval);
}
