"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardSummary } from "@/app/lib/dashboard/summary";

type Summary = DashboardSummary;

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-100 ${className ?? ""}`} />;
}

type EditField = "income" | "expense" | null;

const CATEGORY_ICONS: Record<string, string> = {
  "אוכל": "🍽", "בגדים": "👕", "דלק/רכב": "🚗", "תוכנות/מנויים": "💻",
  "שכירות": "🏠", "בזבוזים": "🎉", "ספר": "📚", "יום הולדת/אירוע מיוחד": "🎂",
};

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
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
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

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* הכנסות */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="flex items-center justify-between">
            <span className="stat-label">הכנסות החודש</span>
            <div className="flex items-center gap-1.5">
              {data?.manualIncome != null && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">ידני</span>
              )}
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => {
                  if (editing === "income") { setEditing(null); }
                  else { setIncomeInput(data?.manualIncome ?? data?.income ?? ""); setEditing("income"); }
                }}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-9 9A2 2 0 0 1 6 16H4v-2a2 2 0 0 1 .586-1.414l9-9Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          {data ? (
            <div className="stat-value text-emerald-700">{data.income} ₪</div>
          ) : (
            <Skeleton className="mt-2.5 h-9 w-28" />
          )}
          {editing === "income" && data && (
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
                  <button onClick={clearIncome} disabled={savingIncome} className="btn text-xs text-zinc-500">
                    איפוס אוטומטי
                  </button>
                )}
              </div>
              {data.incomeFromDocs !== "0.00" && (
                <p className="text-xs text-zinc-400">מקבלות הכנסה: {data.incomeFromDocs} ₪</p>
              )}
            </div>
          )}
        </div>

        {/* הוצאות */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-red-400 to-rose-500" />
          <div className="flex items-center justify-between">
            <span className="stat-label">הוצאות החודש</span>
            <button
              type="button"
              title="פירוט לפי קטגוריה"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              onClick={() => setShowCategoryBreakdown((v) => !v)}
            >
              {/* bar-chart icon */}
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 15V8M8 15V4M13 15v-5M18 15V9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {data ? (
            <div className="stat-value text-red-600">{data.expense} ₪</div>
          ) : (
            <Skeleton className="mt-2.5 h-9 w-28" />
          )}

          {/* Category breakdown popover */}
          {showCategoryBreakdown && data && (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white shadow-lg p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-700">הוצאות לפי קטגוריה</span>
                <button onClick={() => setShowCategoryBreakdown(false)} className="text-zinc-400 hover:text-zinc-600">✕</button>
              </div>
              {data.categoryBreakdown.length === 0 ? (
                <p className="text-zinc-400 text-center py-2">אין תנועות החודש עדיין</p>
              ) : (
                <div className="space-y-2.5">
                  {data.categoryBreakdown.map((item) => {
                    const budget = categoryBudgets[item.category] ?? 0;
                    const pct = budget > 0 ? Math.min((item.amount / budget) * 100, 100) : 0;
                    const isOver = budget > 0 && item.amount > budget;
                    return (
                      <div key={item.category}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="flex items-center gap-1.5 text-zinc-700">
                            <span>{CATEGORY_ICONS[item.category] ?? "📌"}</span>
                            <span>{item.category}</span>
                          </span>
                          <span className={`font-semibold tabular-nums ${isOver ? "text-red-600" : "text-zinc-700"}`}>
                            {item.amount.toLocaleString()}
                            {budget > 0 && (
                              <span className="font-normal text-zinc-400"> / {budget.toLocaleString()} ₪</span>
                            )}
                            {budget === 0 && " ₪"}
                          </span>
                        </div>
                        {budget > 0 && (
                          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isOver
                                  ? "bg-gradient-to-r from-red-400 to-rose-500"
                                  : pct >= 80
                                    ? "bg-gradient-to-r from-amber-400 to-orange-400"
                                    : "bg-gradient-to-r from-emerald-400 to-teal-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="pt-2 border-t border-zinc-100 flex justify-between font-semibold text-zinc-700">
                <span>סה״כ</span>
                <span className="text-red-600">{data.expense} ₪</span>
              </div>
              {Object.keys(categoryBudgets).length === 0 && (
                <p className="text-zinc-400 text-center text-[0.65rem] pb-0.5">
                  הגדר תקציב ב<Link href="/budget" className="text-indigo-500 underline">צ׳ק-אפ פיננסי</Link> לראות התקדמות
                </p>
              )}
            </div>
          )}
        </div>

        {/* הוצאות היום */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-orange-400 to-amber-400" />
          <div className="flex items-center justify-between">
            <span className="stat-label">הוצאות היום</span>
            {data && Number(data.todayExpense) > 0 && (
              <Link href="/transactions"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 10h10M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
          </div>
          {data ? (
            <div className={`stat-value ${Number(data.todayExpense) === 0 ? "text-zinc-400" : "text-orange-600"}`}>
              {data.todayExpense} ₪
            </div>
          ) : (
            <Skeleton className="mt-2.5 h-9 w-28" />
          )}
          {data && Number(data.todayExpense) === 0 && (
            <p className="mt-1.5 text-xs text-zinc-400">עדיין לא הוצאת כלום היום 🎉</p>
          )}
        </div>

        {/* תקציב */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-blue-400 to-indigo-500" />
          <div className="flex items-center justify-between">
            <span className="stat-label">תקציב החודש</span>
            <Link href="/budget"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-9 9A2 2 0 0 1 6 16H4v-2a2 2 0 0 1 .586-1.414l9-9Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          {data ? (
            <>
              <div className="stat-value text-zinc-900">
                {data.budgetLimit ? `${data.budgetLimit} ₪` : "לא הוגדר"}
              </div>
              {data.budgetLimit ? (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">נוצל</span>
                    <span className={`font-bold ${data.pct >= 100 ? "text-red-600" : data.pct >= 80 ? "text-amber-600" : "text-emerald-600"}`}>
                      {data.pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full transition-all ${data.pct >= 100 ? "bg-gradient-to-r from-red-500 to-red-600" : data.pct >= 80 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-emerald-400 to-teal-500"}`}
                      style={{ width: `${data.pct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-400">הגדר תקציב לראות התקדמות</p>
              )}
            </>
          ) : (
            <Skeleton className="mt-2.5 h-9 w-28" />
          )}
        </div>
      </div>

    </div>
  );
}
