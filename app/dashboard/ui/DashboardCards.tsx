"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Summary = {
  income: string;
  expense: string;
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
  return <div className={`animate-pulse rounded bg-zinc-200 ${className ?? ""}`} />;
}

type EditField = "income" | "expense" | "net" | null;

export default function DashboardCards() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<EditField>(null);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Summary) => setData(d))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        שגיאה בטעינת הנתונים.{" "}
        <button className="underline" onClick={() => { setError(false); setData(null); }}>
          נסה שוב
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {/* הכנסות */}
        <div className="card p-4">
          <div className="flex items-center justify-between gap-1">
            <div className="text-sm text-zinc-600">הכנסות החודש</div>
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
              onClick={() => setEditing(editing === "income" ? null : "income")}
            >
              ✏️
            </button>
          </div>
          {data ? (
            <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{data.income} ₪</div>
          ) : (
            <Skeleton className="mt-2 h-9 w-28" />
          )}
          {editing === "income" && data && (
            <div className="mt-2 text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2">
              מחושב מחשבוניות החודש.{" "}
              <Link className="underline font-medium" href="/invoices">חשבוניות →</Link>
            </div>
          )}
        </div>

        {/* הוצאות */}
        <div className="card p-4">
          <div className="flex items-center justify-between gap-1">
            <div className="text-sm text-zinc-600">הוצאות החודש</div>
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
              onClick={() => setEditing(editing === "expense" ? null : "expense")}
            >
              ✏️
            </button>
          </div>
          {data ? (
            <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{data.expense} ₪</div>
          ) : (
            <Skeleton className="mt-2 h-9 w-28" />
          )}
          {editing === "expense" && data && (
            <div className="mt-2 text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2 space-y-1">
              <div>קבלות החזר מס + תנועות החודש.</div>
              <div>
                <Link className="underline font-medium" href="/transactions">תנועות →</Link>
                {" · "}
                <Link className="underline font-medium" href="/receipts">קבלות →</Link>
              </div>
            </div>
          )}
        </div>

        {/* נטו */}
        <div className="card p-4">
          <div className="flex items-center justify-between gap-1">
            <div className="text-sm text-zinc-600">נטו</div>
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
              onClick={() => setEditing(editing === "net" ? null : "net")}
            >
              ✏️
            </button>
          </div>
          {data ? (
            <div className={`mt-2 text-3xl font-semibold tracking-tight ${Number(data.net) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {data.net} ₪
            </div>
          ) : (
            <Skeleton className="mt-2 h-9 w-28" />
          )}
          {editing === "net" && data && (
            <div className="mt-2 text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2">
              הכנסות ({data.income} ₪) פחות הוצאות ({data.expense} ₪).
            </div>
          )}
        </div>

        {/* תקציב */}
        <div className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-zinc-600">תקציב החודש</div>
            <Link className="text-xs underline text-zinc-500" href="/budget">עריכה</Link>
          </div>
          {data ? (
            <>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {data.budgetLimit ? `${data.budgetLimit} ₪` : "—"}
              </div>
              {data.budgetLimit ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span>נוצל</span>
                    <span className={data.pct >= 100 ? "text-red-700" : data.pct >= 80 ? "text-amber-700" : "text-zinc-700"}>
                      {data.pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className={`h-full ${data.pct >= 100 ? "bg-red-600" : data.pct >= 80 ? "bg-amber-500" : "bg-emerald-600"}`}
                      style={{ width: `${data.pct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-zinc-600">הגדר תקציב כדי לראות התקדמות.</div>
              )}
            </>
          ) : (
            <Skeleton className="mt-2 h-9 w-28" />
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">10 תנועות אחרונות</div>
            <div className="mt-0.5 text-xs text-zinc-600">סיכום קצר (פירוט מלא במסך תנועות אחרונות)</div>
          </div>
          <Link className="btn" href="/transactions">לכל התנועות</Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/70 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="px-3 py-2 text-right font-medium">תאריך</th>
                <th className="px-3 py-2 text-right font-medium">בית עסק</th>
                <th className="px-3 py-2 text-right font-medium">סכום</th>
                <th className="px-3 py-2 text-right font-medium">כרטיס</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-3 py-2"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-3 py-2"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-3 py-2"><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
              ) : data.recentTx.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-zinc-600" colSpan={4}>
                    אין תנועות עדיין.{" "}
                    <Link className="underline" href="/transactions">הוסף תנועה</Link>
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
                        <tr key={`m-${m}`} className="bg-zinc-50/60">
                          <td className="px-3 py-2 text-xs font-semibold text-zinc-700" colSpan={4}>
                            {monthLabel(t.date)}
                          </td>
                        </tr>,
                      );
                    }
                    out.push(
                      <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                        <td className="px-3 py-2">{t.date}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-zinc-900">{t.vendor}</span>
                          {t.description ? <div className="mt-0.5 text-xs text-zinc-600">{t.description}</div> : null}
                        </td>
                        <td className="px-3 py-2">
                          {t.amount} <span className="text-xs text-zinc-600">{t.currency}</span>
                        </td>
                        <td className="px-3 py-2">{t.cardLast4 ? `•••• ${t.cardLast4}` : "—"}</td>
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
    </>
  );
}
