/** Document date when uploading into a year archive folder. */
export function documentDateForArchiveYear(year: number): Date {
  const now = new Date();
  if (now.getFullYear() === year) return now;
  return new Date(year, 11, 31, 12, 0, 0);
}

export function parseArchiveMonth(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = parseInt(raw, 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  return m;
}

export function archiveDateBounds(year: number, month?: number | null) {
  if (month && month >= 1 && month <= 12) {
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 1),
      month,
    };
  }
  const { start, end } = yearBounds(year);
  return { start, end, month: null as number | null };
}

/** Upload date: respects active month filter when set. */
export function documentDateForArchive(year: number, month?: number | null): Date {
  const now = new Date();
  if (month && month >= 1 && month <= 12) {
    if (now.getFullYear() === year && now.getMonth() + 1 === month) return now;
    return new Date(year, month - 1, 15, 12, 0, 0);
  }
  return documentDateForArchiveYear(year);
}

export function hebrewMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("he-IL", { month: "long" }).format(new Date(year, month - 1, 1));
}

export function archiveQueryString(year: number, month?: number | null) {
  const q = new URLSearchParams({ year: String(year) });
  if (month && month >= 1 && month <= 12) q.set("month", String(month));
  return q.toString();
}

export function yearBounds(year: number) {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
  };
}
