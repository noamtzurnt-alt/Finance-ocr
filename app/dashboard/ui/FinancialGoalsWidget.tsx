"use client";

import { categoryColor } from "@/app/lib/ui/category-color";

type Item = { category: string; amount: number };

export default function FinancialGoalsWidget(props: {
  categoryBreakdown: Item[];
  categoryBudgets: Record<string, number>;
}) {
  const rows = Object.entries(props.categoryBudgets)
    .map(([category, budget]) => {
      const spent = props.categoryBreakdown.find((c) => c.category === category)?.amount ?? 0;
      return { category, budget, spent, pct: budget > 0 ? Math.min(100, (spent / budget) * 100) : 0 };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  return (
    <div className="card p-6 dash-enter">
      <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>יעדים פיננסיים</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          הגדר תקציב לפי קטגוריה כדי לראות יעדים כאן
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map((row) => {
            const color = categoryColor(row.category);
            const isOver = row.spent > row.budget;
            return (
              <div key={row.category}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="cat-dot shrink-0" style={{ background: color }} />
                    <span className="truncate" style={{ color: "var(--foreground)" }}>{row.category}</span>
                  </span>
                  <span className="amount shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                    {Math.round(row.spent).toLocaleString()} / {Math.round(row.budget).toLocaleString()} ₪
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${row.pct}%`, background: isOver ? "var(--negative)" : "var(--brand)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
