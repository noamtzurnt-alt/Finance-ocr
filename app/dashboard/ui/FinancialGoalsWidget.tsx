"use client";

import Link from "next/link";
import { IconKebab } from "@/app/ui/icons";

type Item = { category: string; amount: number };

export default function FinancialGoalsWidget(props: {
  categoryBreakdown: Item[];
  categoryBudgets: Record<string, number>;
}) {
  const rows = Object.entries(props.categoryBudgets)
    .map(([category, budget]) => {
      const spent = props.categoryBreakdown.find((c) => c.category === category)?.amount ?? 0;
      const remaining = Math.max(0, budget - spent);
      return { category, budget, spent, remaining, pct: budget > 0 ? Math.min(100, (spent / budget) * 100) : 0 };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  return (
    <div className="card p-5 sm:p-6 dash-enter">
      <div className="card-head">
        <h3>יעדים פיננסיים</h3>
        <Link href="/budget" className="card-kebab" aria-label="תקציב">
          <IconKebab className="h-4 w-4" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          הגדר תקציב לפי קטגוריה כדי לראות יעדים כאן
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const isOver = row.spent > row.budget;
            return (
              <div key={row.category}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium" style={{ color: "var(--foreground)" }}>{row.category}</span>
                  <span className="amount shrink-0 text-xs" style={{ color: isOver ? "var(--negative)" : "var(--muted)" }}>
                    {Math.round(row.pct)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                  <div
                    className="goal-fill h-full rounded-full"
                    style={{ width: `${row.pct}%`, background: isOver ? "var(--negative)" : "var(--brand)" }}
                  />
                </div>
                <div className="mt-1 text-[0.7rem]" style={{ color: "var(--muted)" }}>
                  {Math.round(row.spent).toLocaleString()} / {Math.round(row.budget).toLocaleString()} ₪
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
