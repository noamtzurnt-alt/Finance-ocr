/** Calendar helpers on local "YYYY-MM-DD" strings (no time zone math). */

export const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const WEEKDAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(now = new Date()) {
  return toIso(now);
}

export function addDays(iso: string, n: number) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);
}

export function nowTime(now = new Date()) {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function isOverdue(dueDate: string | null, dueTime: string | null, now = new Date()) {
  if (!dueDate) return false;
  const today = toIso(now);
  if (dueDate < today) return true;
  if (dueDate > today) return false;
  return dueTime ? dueTime < nowTime(now) : false;
}

export function formatDue(dueDate: string | null, dueTime: string | null, now = new Date()) {
  if (!dueDate) return "";
  const today = toIso(now);
  const diff = daysBetween(today, dueDate);
  let day: string;
  if (diff === 0) day = "היום";
  else if (diff === 1) day = "מחר";
  else if (diff === -1) day = "אתמול";
  else if (diff > 1 && diff < 7) day = `יום ${WEEKDAYS[fromIso(dueDate).getDay()]}`;
  else {
    const d = fromIso(dueDate);
    day = `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
  }
  return dueTime ? `${day}, ${dueTime}` : day;
}

export function formatDayHeading(iso: string, now = new Date()) {
  const diff = daysBetween(toIso(now), iso);
  const d = fromIso(iso);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (diff === 0) return `היום · ${base}`;
  if (diff === 1) return `מחר · ${base}`;
  return base;
}
