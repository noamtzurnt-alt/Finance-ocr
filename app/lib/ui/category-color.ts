/**
 * Deterministic category -> color mapping shared between the category badges
 * (app/globals.css .cat-dot) and the dashboard's category donut chart, so a
 * given category always reads as the same color everywhere in the app.
 *
 * Colors are the validated dark-mode categorical steps (fixed adjacent order,
 * see the dataviz skill) — never cycled per render, always assigned by a
 * stable hash of the category name so the same category keeps its color
 * across sessions even as other categories are added/removed.
 */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

export const CHART_OTHER_COLOR = "var(--chart-other)";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function categoryColor(name: string | null | undefined): string {
  if (!name) return CHART_OTHER_COLOR;
  return CHART_COLORS[hashString(name) % CHART_COLORS.length]!;
}
