"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  income: string;
  expense: string;
  net: string;
  budgetLimit: string;
  pct: number;
};

type EditField = "income" | "expense" | "net" | null;

export default function DashboardCards({ income, expense, net, budgetLimit, pct }: Props) {
  const [editing, setEditing] = useState<EditField>(null);

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {/* הכנסות */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-1">
          <div className="text-sm text-zinc-600">הכנסות החודש</div>
          <button
            type="button"
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
            title="עבור לחשבוניות לעריכה"
            onClick={() => setEditing(editing === "income" ? null : "income")}
          >
            ✏️
          </button>
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{income} ₪</div>
        {editing === "income" && (
          <div className="mt-2 text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2">
            הכנסות מחושבות מחשבוניות שהועלו החודש.{" "}
            <Link className="underline font-medium" href="/invoices">
              עבור לחשבוניות →
            </Link>
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
            title="עבור לתנועות לעריכה"
            onClick={() => setEditing(editing === "expense" ? null : "expense")}
          >
            ✏️
          </button>
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{expense} ₪</div>
        {editing === "expense" && (
          <div className="mt-2 text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2 space-y-1">
            <div>הוצאות = קבלות החזר מס + תנועות החודש.</div>
            <div>
              <Link className="underline font-medium" href="/transactions">תנועות →</Link>
              {" · "}
              <Link className="underline font-medium" href="/receipts">קבלות החזר מס →</Link>
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
            title="נטו = הכנסות פחות הוצאות"
            onClick={() => setEditing(editing === "net" ? null : "net")}
          >
            ✏️
          </button>
        </div>
        <div className={`mt-2 text-3xl font-semibold tracking-tight ${Number(net) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
          {net} ₪
        </div>
        {editing === "net" && (
          <div className="mt-2 text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2">
            נטו = הכנסות ({income} ₪) פחות הוצאות ({expense} ₪).
          </div>
        )}
      </div>

      {/* תקציב */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-zinc-600">תקציב החודש</div>
          <Link className="text-xs underline text-zinc-500" href="/budget">
            עריכה
          </Link>
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          {budgetLimit ? `${budgetLimit} ₪` : "—"}
        </div>
        {budgetLimit ? (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-zinc-600">
              <span>נוצל</span>
              <span className={pct >= 100 ? "text-red-700" : pct >= 80 ? "text-amber-700" : "text-zinc-700"}>
                {pct}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className={`h-full ${pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-600"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 text-xs text-zinc-600">הגדר תקציב כדי לראות התקדמות.</div>
        )}
      </div>
    </div>
  );
}
