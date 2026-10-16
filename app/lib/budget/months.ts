export const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/** How far back the dashboard month picker goes. */
export const DASHBOARD_MONTH_HISTORY = 36;

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonthKey(month: string): { year: number; monthIndex: number } | null {
  const match = MONTH_KEY.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 2000 || year > 2100) return null;
  return { year, monthIndex: Number(match[2]) - 1 };
}

export function formatMonthKey(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month: string, delta: number): string | null {
  const parsed = parseMonthKey(month);
  if (!parsed) return null;
  const next = formatMonthKey(parsed.year, parsed.monthIndex + delta);
  return parseMonthKey(next) ? next : null;
}

export function monthLabel(month: string): string {
  const parsed = parseMonthKey(month);
  if (!parsed) return month;
  return `${HEBREW_MONTHS[parsed.monthIndex]} ${parsed.year}`;
}

export function recentMonthOptions(currentMonth: string, count = DASHBOARD_MONTH_HISTORY) {
  const options: { value: string; label: string }[] = [];
  let cursor: string | null = currentMonth;
  for (let i = 0; i < count && cursor; i++) {
    options.push({ value: cursor, label: monthLabel(cursor) });
    cursor = addMonths(cursor, -1);
  }
  return options;
}
