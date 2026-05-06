"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DfsiData = {
  status: "excellent" | "on_track" | "warning" | "over";
  spendingVelocity: number;
  dailyBudget: string;
  safeToSpendToday: string;
  variableExpenses: string;
  fixedExpenses: string;
  disposableIncome: string;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  nudge: string;
  hasIncome: boolean;
};

type Summary = {
  income: string;
  manualIncome: string | null;
  incomeFromDocs: string;
  expense: string;
  todayExpense: string;
  net: string;
  budgetLimit: string;
  pct: number;
  dfsi: DfsiData;
};

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-100 ${className ?? ""}`} />;
}

type EditField = "income" | "expense" | null;

const DFSI_CONFIG = {
  excellent: { label: "מעולה", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-gradient-to-r from-emerald-400 to-teal-500", icon: "✓" },
  on_track:  { label: "במסלול", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", bar: "bg-gradient-to-r from-blue-400 to-indigo-500", icon: "→" },
  warning:   { label: "שים לב", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-gradient-to-r from-amber-400 to-orange-500", icon: "!" },
  over:      { label: "חריגה", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", bar: "bg-gradient-to-r from-red-500 to-rose-600", icon: "✗" },
};

export default function DashboardCards() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<EditField>(null);
  const [incomeInput, setIncomeInput] = useState("");
  const [savingIncome, setSavingIncome] = useState(false);

  function loadData() {
    fetch("/api/dashboard/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Summary) => { setData(d); setIncomeInput(d.manualIncome ?? ""); })
      .catch(() => setError(true));
  }

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveIncome() {
    setSavingIncome(true);
    const res = await fetch("/api/dashboard/income", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: incomeInput }),
    });
    setSavingIncome(false);
    if (res.ok) { setEditing(null); loadData(); }
  }

  async function clearIncome() {
    setSavingIncome(true);
    await fetch("/api/dashboard/income", { method: "DELETE" });
    setSavingIncome(false);
    setEditing(null);
    loadData();
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        שגיאה בטעינת הנתונים.{" "}
        <button className="font-semibold underline" onClick={() => { setError(false); setData(null); loadData(); }}>
          נסה שוב
        </button>
      </div>
    );
  }

  const dfsi = data?.dfsi;
  const dfsiCfg = dfsi ? DFSI_CONFIG[dfsi.status] : DFSI_CONFIG.on_track;
  const velCapped = Math.min(dfsi?.spendingVelocity ?? 0, 150);

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

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
                <p className="text-xs text-zinc-400">מחשבוניות: {data.incomeFromDocs} ₪</p>
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
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              onClick={() => setEditing(editing === "expense" ? null : "expense")}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="10" cy="10" r="8" /><path d="M10 6v4l2.5 2.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {data ? (
            <div className="stat-value text-red-600">{data.expense} ₪</div>
          ) : (
            <Skeleton className="mt-2.5 h-9 w-28" />
          )}
          {editing === "expense" && data && (
            <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 space-y-1">
              <p>קבלות החזר מס + תנועות החודש</p>
              <div className="flex gap-3">
                <Link className="font-semibold text-indigo-600 underline" href="/transactions">תנועות →</Link>
                <Link className="font-semibold text-indigo-600 underline" href="/receipts">קבלות →</Link>
              </div>
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
                {data.budgetLimit ? `${data.budgetLimit} ₪` : "—"}
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

      {/* ── DFSI: Daily Financial Status Indicator ── */}
      <div className={`card overflow-hidden border ${dfsi ? dfsiCfg.border : "border-zinc-200"}`}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="font-semibold text-zinc-900">מדד פיננסי יומי</div>
              {dfsi && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${dfsiCfg.bg} ${dfsiCfg.color} ${dfsiCfg.border} border`}>
                  <span>{dfsiCfg.icon}</span>
                  {dfsiCfg.label}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              מחשב על בסיס הוצאות משתנות בלבד — הוצאות קבועות (שכירות, אשראי) לא פוגעות בציון
            </div>
          </div>
          <Link className="btn text-sm" href="/transactions">תנועות</Link>
        </div>

        <div className="p-5">
          {!data ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : !dfsi?.hasIncome ? (
            /* No income set */
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">💡</div>
              <div>
                <div className="font-semibold text-zinc-800">הגדר הכנסה חודשית לקבל תמונת מצב</div>
                <div className="mt-1 text-sm text-zinc-500">לחץ על ✏️ ליד "הכנסות החודש" כדי להזין הכנסה</div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Velocity bar */}
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-700">קצב הוצאות משתנות</span>
                  <span className={`font-bold text-lg ${dfsiCfg.color}`}>{dfsi.spendingVelocity}%</span>
                </div>
                <div className="relative h-4 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${dfsiCfg.bar}`}
                    style={{ width: `${Math.min(velCapped / 1.5, 100)}%` }}
                  />
                  {/* 100% marker */}
                  <div className="absolute top-0 bottom-0 w-px bg-zinc-400 opacity-40" style={{ left: "66.67%" }} />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-zinc-400">
                  <span>0%</span>
                  <span>100% (יעד יומי)</span>
                  <span>150%</span>
                </div>
              </div>

              {/* Nudge message */}
              <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${dfsiCfg.bg} ${dfsiCfg.border} ${dfsiCfg.color}`}>
                {dfsi.nudge}
              </div>

              {/* Key stats grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-zinc-50 p-3 text-center">
                  <div className="text-xs text-zinc-400 mb-1">מותר להוציא היום</div>
                  <div className={`text-xl font-bold ${Number(dfsi.safeToSpendToday) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {Number(dfsi.safeToSpendToday) > 0 ? dfsi.safeToSpendToday : "0"} ₪
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 text-center">
                  <div className="text-xs text-zinc-400 mb-1">תקציב יומי</div>
                  <div className="text-xl font-bold text-zinc-700">{Number(dfsi.dailyBudget).toFixed(0)} ₪</div>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 text-center">
                  <div className="text-xs text-zinc-400 mb-1">הוצ׳ משתנות</div>
                  <div className="text-xl font-bold text-zinc-700">{dfsi.variableExpenses} ₪</div>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 text-center">
                  <div className="text-xs text-zinc-400 mb-1">ימים נותרים</div>
                  <div className="text-xl font-bold text-zinc-700">{dfsi.daysRemaining}</div>
                </div>
              </div>

              {/* Days progress bar */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500">
                  <span>יום {dfsi.daysElapsed} מתוך {dfsi.daysInMonth}</span>
                  {Number(dfsi.fixedExpenses) > 0 && (
                    <span className="text-zinc-400">קבועות החודש: {dfsi.fixedExpenses} ₪</span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-zinc-400 transition-all"
                    style={{ width: `${(dfsi.daysElapsed / dfsi.daysInMonth) * 100}%` }}
                  />
                </div>
              </div>

              {/* Fixed expenses tip if none set */}
              {Number(dfsi.fixedExpenses) === 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-xs text-zinc-500">
                  <span className="mt-0.5 shrink-0 text-base">💡</span>
                  <span>
                    סמן תנועות קבועות (שכירות, ביטוח, אשראי חודשי) כ"קבועה" בעמוד{" "}
                    <Link href="/transactions" className="font-semibold text-indigo-600 underline">תנועות</Link>{" "}
                    כדי שהמדד יחשב נכון יותר.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
