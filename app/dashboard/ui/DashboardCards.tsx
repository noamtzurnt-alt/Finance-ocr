"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardSummary } from "@/app/lib/dashboard/summary";
import { useCountUp } from "@/app/lib/ui/use-count-up";
import CategoryDonutChart from "./CategoryDonutChart";
import SpendTrendChart from "./SpendTrendChart";

type Summary = DashboardSummary;
type EditField = "income" | null;

function fmt(n: number) {
  return n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Animated amount: counts up from its previous value on every data change. */
function AnimatedAmount(props: { value: string; className?: string; style?: React.CSSProperties }) {
  const n = useCountUp(Number(props.value) || 0);
  return (
    <span className={props.className} style={props.style}>
      {fmt(n)} ₪
    </span>
  );
}

export default function DashboardCards(props: {
  initialSummary: Summary;
  initialCategoryBudgets: Record<string, number>;
}) {
  const router = useRouter();
  const [data, setData] = useState<Summary>(props.initialSummary);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<EditField>(null);
  const [incomeInput, setIncomeInput] = useState(props.initialSummary.manualIncome ?? "");
  const [savingIncome, setSavingIncome] = useState(false);
  const categoryBudgets = props.initialCategoryBudgets;

  // Keep in sync when the server component re-fetches (e.g. via router.refresh()
  // from LiveRefresh's SSE listener, or after a mutation below).
  useEffect(() => {
    setData(props.initialSummary);
  }, [props.initialSummary]);

  async function saveIncome() {
    setSavingIncome(true);
    const res = await fetch("/api/dashboard/income", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: incomeInput }),
    });
    setSavingIncome(false);
    if (res.ok) {
      setEditing(null);
      router.refresh();
    } else {
      setError(true);
    }
  }

  async function clearIncome() {
    setSavingIncome(true);
    await fetch("/api/dashboard/income", { method: "DELETE" });
    setSavingIncome(false);
    setEditing(null);
    router.refresh();
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        שגיאה בטעינת הנתונים.{" "}
        <button className="font-semibold underline" onClick={() => { setError(false); router.refresh(); }}>
          נסה שוב
        </button>
      </div>
    );
  }

  const net = Number(data.net);
  const netClass = net > 0 ? "amount-positive" : net < 0 ? "amount-negative" : "";

  return (
    <div className="space-y-6">
      {/* ── Bento row: one hero tile (cashflow) + two supporting tiles ── */}
      <div className="grid gap-6 xl:grid-cols-4">

        {/* תזרים החודש — hero tile, spans 2 columns */}
        <div className="card p-6 relative overflow-hidden dash-enter xl:col-span-2" style={{ animationDelay: "0ms" }}>
          <span className="stat-label">תזרים החודש</span>
          <div className={`stat-value ${netClass}`}>
            <AnimatedAmount value={data.net} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {/* הכנסות */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>הכנסות</span>
                <div className="flex items-center gap-1">
                  {data.manualIncome != null && (
                    <span className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold" style={{ background: "var(--brand-soft)", color: "var(--brand-2)" }}>ידני</span>
                  )}
                  <button
                    type="button"
                    aria-label="ערוך הכנסה"
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-[var(--surface)]/10"
                    style={{ color: "var(--muted)" }}
                    onClick={() => {
                      if (editing === "income") { setEditing(null); }
                      else { setIncomeInput(data.manualIncome ?? data.income ?? ""); setEditing("income"); }
                    }}
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-9 9A2 2 0 0 1 6 16H4v-2a2 2 0 0 1 .586-1.414l9-9Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="amount amount-positive text-xl mt-1">
                <AnimatedAmount value={data.income} />
              </div>

              {editing === "income" && (
                <div className="mt-3 space-y-2">
                  <input type="number" min="0" step="0.01" value={incomeInput}
                    onChange={(e) => setIncomeInput(e.target.value)}
                    placeholder="הזן סכום ₪" className="field text-sm" />
                  <div className="flex gap-2">
                    <button onClick={saveIncome} disabled={savingIncome || !incomeInput}
                      className="btn btn-primary text-xs disabled:opacity-60">
                      {savingIncome ? "שומר..." : "שמור"}
                    </button>
                    {data.manualIncome != null && (
                      <button onClick={clearIncome} disabled={savingIncome} className="btn text-xs">
                        איפוס אוטומטי
                      </button>
                    )}
                  </div>
                  {data.incomeFromDocs !== "0.00" && (
                    <p className="text-xs" style={{ color: "var(--muted)" }}>מקבלות הכנסה: {data.incomeFromDocs} ₪</p>
                  )}
                </div>
              )}
            </div>

            {/* הוצאות */}
            <div>
              <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>הוצאות</span>
              <div className="amount amount-negative text-xl mt-1">
                <AnimatedAmount value={data.expense} />
              </div>
            </div>
          </div>
        </div>

        {/* הוצאות היום */}
        <div className="card p-6 relative overflow-hidden dash-enter" style={{ animationDelay: "70ms" }}>
          <div className="flex items-center justify-between">
            <span className="stat-label">הוצאות היום</span>
            {Number(data.todayExpense) > 0 && (
              <Link href="/transactions"
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--surface)]/10" style={{ color: "var(--muted)" }}>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 10h10M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
          </div>
          <div className={`stat-value ${Number(data.todayExpense) === 0 ? "" : "amount-negative"}`} style={Number(data.todayExpense) === 0 ? { color: "var(--muted)" } : undefined}>
            <AnimatedAmount value={data.todayExpense} />
          </div>
          {Number(data.todayExpense) === 0 && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>עדיין לא הוצאת כלום היום</p>
          )}
        </div>

        {/* תקציב */}
        <div className="card p-6 relative overflow-hidden dash-enter" style={{ animationDelay: "140ms" }}>
          <div className="flex items-center justify-between">
            <span className="stat-label">תקציב החודש</span>
            <Link href="/budget"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--surface)]/10" style={{ color: "var(--muted)" }}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-9 9A2 2 0 0 1 6 16H4v-2a2 2 0 0 1 .586-1.414l9-9Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          <div className="stat-value">
            {data.budgetLimit ? <AnimatedAmount value={data.budgetLimit} /> : "לא הוגדר"}
          </div>
          {data.budgetLimit ? (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span style={{ color: "var(--muted)" }}>נוצל</span>
                <span className="font-bold" style={{ color: data.pct >= 100 ? "var(--negative)" : data.pct >= 80 ? "var(--brand-2)" : "var(--positive)" }}>
                  {data.pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${data.pct}%`,
                    background: data.pct >= 100 ? "var(--negative)" : data.pct >= 80 ? "linear-gradient(90deg, var(--brand), var(--brand-2))" : "var(--positive)",
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>הגדר תקציב לראות התקדמות</p>
          )}
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="card p-6 dash-enter xl:col-span-3" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>מגמת הוצאות מצטברת</h3>
            <span className="stat-label">{data.todayDay}/{data.daysInMonth} ימים</span>
          </div>
          <div className="mt-3">
            <SpendTrendChart
              points={data.dailySpend}
              daysInMonth={data.daysInMonth}
              todayDay={data.todayDay}
              budgetLimit={data.budgetLimit ? Number(data.budgetLimit) : null}
            />
          </div>
        </div>

        <div className="card p-6 dash-enter xl:col-span-2" style={{ animationDelay: "260ms" }}>
          <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>הוצאות לפי קטגוריה</h3>
          <div className="mt-4">
            <CategoryDonutChart items={data.categoryBreakdown} />
          </div>
          {Object.keys(categoryBudgets).length > 0 && (
            <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              {data.categoryBreakdown.slice(0, 4).map((item) => {
                const budget = categoryBudgets[item.category] ?? 0;
                if (budget <= 0) return null;
                const pct = Math.min((item.amount / budget) * 100, 100);
                const isOver = item.amount > budget;
                return (
                  <div key={item.category}>
                    <div className="flex items-center justify-between text-[0.7rem]" style={{ color: "var(--muted)" }}>
                      <span>{item.category}</span>
                      <span>{Math.round(item.amount).toLocaleString()} / {budget.toLocaleString()} ₪</span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: isOver ? "var(--negative)" : "var(--brand-2)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
