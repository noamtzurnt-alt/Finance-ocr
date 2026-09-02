"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardSummary } from "@/app/lib/dashboard/summary";

type Summary = DashboardSummary;

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

  const net = Number(data.net);
  const netClass = net > 0 ? "amount-positive" : net < 0 ? "amount-negative" : "";

  return (
    <div className="space-y-6">
      {/* ── Bento row: one hero tile (cashflow) + two supporting tiles ── */}
      <div className="grid gap-6 xl:grid-cols-4">

        {/* תזרים החודש — hero tile, spans 2 columns */}
        <div className="card p-6 relative overflow-hidden dash-enter xl:col-span-2" style={{ animationDelay: "0ms" }}>
          <span className="stat-label">תזרים החודש</span>
          <div className={`stat-value ${netClass}`}>{data.net} ₪</div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {/* הכנסות */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>הכנסות</span>
                <div className="flex items-center gap-1">
                  {data.manualIncome != null && (
                    <span className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>ידני</span>
                  )}
                  <button
                    type="button"
                    aria-label="ערוך הכנסה"
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-black/5"
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
              <div className="amount amount-positive text-xl mt-1">{data.income} ₪</div>

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
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>הוצאות</span>
                <button
                  type="button"
                  title="פירוט לפי קטגוריה"
                  aria-label="פירוט לפי קטגוריה"
                  className="flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-black/5"
                  style={{ color: "var(--muted)" }}
                  onClick={() => setShowCategoryBreakdown((v) => !v)}
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 15V8M8 15V4M13 15v-5M18 15V9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className="amount amount-negative text-xl mt-1">{data.expense} ₪</div>

              {showCategoryBreakdown && (
                <div
                  className="popover-in absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border p-4 space-y-3 text-xs"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)", transformOrigin: "top left" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>הוצאות לפי קטגוריה</span>
                    <button onClick={() => setShowCategoryBreakdown(false)} style={{ color: "var(--muted)" }}>✕</button>
                  </div>
                  {data.categoryBreakdown.length === 0 ? (
                    <p className="text-center py-2" style={{ color: "var(--muted)" }}>אין תנועות החודש עדיין</p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.categoryBreakdown.map((item) => {
                        const budget = categoryBudgets[item.category] ?? 0;
                        const pct = budget > 0 ? Math.min((item.amount / budget) * 100, 100) : 0;
                        const isOver = budget > 0 && item.amount > budget;
                        return (
                          <div key={item.category}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="cat-badge">
                                {CATEGORY_ICONS[item.category] ?? "📌"} {item.category}
                              </span>
                              <span className={`amount ${isOver ? "amount-negative" : ""}`}>
                                {item.amount.toLocaleString()}
                                {budget > 0 && (
                                  <span className="font-normal" style={{ color: "var(--muted)" }}> / {budget.toLocaleString()} ₪</span>
                                )}
                                {budget === 0 && " ₪"}
                              </span>
                            </div>
                            {budget > 0 && (
                              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    background: isOver ? "var(--negative)" : pct >= 80 ? "var(--gold)" : "var(--positive)",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="pt-2 border-t flex justify-between font-semibold" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                    <span>סה״כ</span>
                    <span className="amount amount-negative">{data.expense} ₪</span>
                  </div>
                  {Object.keys(categoryBudgets).length === 0 && (
                    <p className="text-center text-[0.65rem] pb-0.5" style={{ color: "var(--muted)" }}>
                      הגדר תקציב ב<Link href="/budget" className="underline" style={{ color: "var(--gold)" }}>צ׳ק-אפ פיננסי</Link> לראות התקדמות
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* הוצאות היום */}
        <div className="card p-6 relative overflow-hidden dash-enter" style={{ animationDelay: "70ms" }}>
          <div className="flex items-center justify-between">
            <span className="stat-label">הוצאות היום</span>
            {Number(data.todayExpense) > 0 && (
              <Link href="/transactions"
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5" style={{ color: "var(--muted)" }}>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 10h10M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
          </div>
          <div className={`stat-value ${Number(data.todayExpense) === 0 ? "" : "amount-negative"}`} style={Number(data.todayExpense) === 0 ? { color: "var(--muted)" } : undefined}>
            {data.todayExpense} ₪
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
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5" style={{ color: "var(--muted)" }}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-9 9A2 2 0 0 1 6 16H4v-2a2 2 0 0 1 .586-1.414l9-9Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          <div className="stat-value">
            {data.budgetLimit ? `${data.budgetLimit} ₪` : "לא הוגדר"}
          </div>
          {data.budgetLimit ? (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span style={{ color: "var(--muted)" }}>נוצל</span>
                <span className="font-bold" style={{ color: data.pct >= 100 ? "var(--negative)" : data.pct >= 80 ? "var(--gold)" : "var(--positive)" }}>
                  {data.pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${data.pct}%`,
                    background: data.pct >= 100 ? "var(--negative)" : data.pct >= 80 ? "var(--gold)" : "var(--positive)",
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>הגדר תקציב לראות התקדמות</p>
          )}
        </div>
      </div>
    </div>
  );
}
