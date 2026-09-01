/**
 * Shared date-range logic for the expense archive list, used both server-side
 * (initial SSR fetch) and client-side (subsequent filter changes) so the two
 * stay in sync.
 */
export function expenseDateRange(input: {
  year: number;
  month: number | null;
  from?: string;
  to?: string;
}): { from: string; to?: string } {
  const { year, month, from, to } = input;

  if (from) {
    return { from, to };
  }
  if (month) {
    const m = String(month).padStart(2, "0");
    const last = new Date(year, month, 0).getDate();
    return {
      from: `${year}-${m}-01`,
      to: to ?? `${year}-${m}-${String(last).padStart(2, "0")}`,
    };
  }
  return {
    from: `${year}-01-01`,
    to: to ?? `${year}-12-31`,
  };
}
