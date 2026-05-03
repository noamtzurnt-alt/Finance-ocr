"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Summary = {
  income: string;
  manualIncome: string | null;
  incomeFromDocs: string;
  expense: string;
  todayExpense: string;
  net: string;
  budgetLimit: string;
  pct: number;
  recentTx: {
    id: string;
    date: string;
    amount: string;
    currency: string;
    vendor: string;
    description: string | null;
    cardLast4: string | null;
  }[];
};

function monthLabel(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-100 ${className ?? ""}`} />;
}

type EditField = "income" | "expense" | null;

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

  const net = data ? Number(data.income) - Number(data.expense) : 0;

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* הכנסות */}
        <div className="card p-5 relative overflow-hidden">
          {/* gradient accent strip */}
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

      {/* Net summary strip */}
      {data && (
        <div className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 ${net >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${net >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
            <svg viewBox="0 0 20 20" className={`h-5 w-5 ${net >= 0 ? "text-emerald-600" : "text-red-600"}`} fill="none" stroke="currentColor" strokeWidth="1.8">
              {net >= 0
                ? <path d="M10 17V3m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                : <path d="M10 3v14m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              }
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">נטו החודש</div>
            <div className={`text-xl font-bold tracking-tight ${net >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {net >= 0 ? "+" : ""}{net.toFixed(2)} ₪
            </div>
          </div>
          <div className="mr-auto text-xs text-zinc-400">
            {data.income} ₪ הכנסות − {data.expense} ₪ הוצאות
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <div className="font-semibold text-zinc-900">תנועות אחרונות</div>
            <div className="mt-0.5 text-xs text-zinc-500">10 התנועות האחרונות שלך</div>
          </div>
          <Link className="btn text-sm" href="/transactions">לכל התנועות</Link>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>בית עסק</th>
              <th>סכום</th>
              <th>כרטיס</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton className="h-4 w-20" /></td>
                  <td><Skeleton className="h-4 w-32" /></td>
                  <td><Skeleton className="h-4 w-16" /></td>
                  <td><Skeleton className="h-4 w-16" /></td>
                </tr>
              ))
            ) : data.recentTx.length === 0 ? (
              <tr>
                <td className="py-12 text-center text-zinc-400" colSpan={4}>
                  אין תנועות עדיין.{" "}
                  <Link className="font-semibold text-indigo-600 underline" href="/transactions">הוסף תנועה</Link>
                </td>
              </tr>
            ) : (
              (() => {
                const out: React.ReactNode[] = [];
                let lastMonth = "";
                for (const t of data.recentTx) {
                  const m = t.date.slice(0, 7);
                  if (m !== lastMonth) {
                    lastMonth = m;
                    out.push(
                      <tr key={`m-${m}`} className="month-divider">
                        <td colSpan={4}>{monthLabel(t.date)}</td>
                      </tr>,
                    );
                  }
                  out.push(
                    <tr key={t.id}>
                      <td className="text-zinc-500">{t.date}</td>
                      <td>
                        <span className="font-medium text-zinc-900">{t.vendor}</span>
                        {t.description && <div className="mt-0.5 text-xs text-zinc-400">{t.description}</div>}
                      </td>
                      <td>
                        <span className="font-semibold text-zinc-900">{t.amount}</span>
                        <span className="mr-1 text-xs text-zinc-400">{t.currency}</span>
                      </td>
                      <td className="text-zinc-400 text-xs">{t.cardLast4 ? `•••• ${t.cardLast4}` : "—"}</td>
                    </tr>,
                  );
                }
                return out;
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
