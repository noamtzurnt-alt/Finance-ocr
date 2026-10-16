"use client";

import { useState } from "react";
import AppModal from "@/app/ui/AppModal";
import type { DashboardSummary } from "@/app/lib/dashboard/summary";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function monthName(key: string | null) {
  if (!key) return "";
  const m = Number(key.slice(5, 7));
  return `${HEBREW_MONTHS[m - 1] ?? ""} ${key.slice(0, 4)}`;
}

function Row(props: { label: string; value: string; sub?: string; strong?: boolean; tone?: "neg" | "pos" }) {
  return (
    <div className={`dash-sheet-row${props.strong ? " is-strong" : ""}`}>
      <div className="min-w-0">
        <div className="dash-sheet-row-label">{props.label}</div>
        {props.sub ? <div className="dash-sheet-row-sub">{props.sub}</div> : null}
      </div>
      <div className={`dash-sheet-row-value amount${props.tone === "neg" ? " text-negative" : props.tone === "pos" ? " text-positive" : ""}`}>
        {props.value}
      </div>
    </div>
  );
}

export function IncomeEditSheet(props: {
  open: boolean;
  onClose: () => void;
  summary: DashboardSummary;
  onSaved: () => void;
}) {
  const parts = props.summary.incomeParts;
  const [salary, setSalary] = useState(parts.salary ? String(parts.salary) : "");
  const [other, setOther] = useState(parts.other ? String(parts.other) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salaryN = Number(salary) || 0;
  const otherN = Number(other) || 0;
  const savings = props.summary.budgetDetails.savings;
  const newLimit = Math.max(0, salaryN + otherN - savings);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/dashboard/income", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ salary: salaryN, other: otherN }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "השמירה נכשלה. נסה שוב.");
      return;
    }
    props.onSaved();
    props.onClose();
  }

  return (
    <AppModal open={props.open} onClose={props.onClose} title="הכנסה חודשית">
      <div className="dash-sheet">
        <label className="dash-sheet-field">
          <span className="dash-sheet-field-label">משכורת נטו</span>
          <span className="dash-sheet-input-wrap">
            <input
              className="dash-sheet-input amount"
              inputMode="numeric"
              dir="ltr"
              value={salary}
              onChange={(e) => setSalary(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              autoFocus
            />
            <span className="dash-sheet-input-unit">₪</span>
          </span>
        </label>

        <label className="dash-sheet-field">
          <span className="dash-sheet-field-label">הכנסה אחרת</span>
          <span className="dash-sheet-input-wrap">
            <input
              className="dash-sheet-input amount"
              inputMode="numeric"
              dir="ltr"
              value={other}
              onChange={(e) => setOther(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
            <span className="dash-sheet-input-unit">₪</span>
          </span>
        </label>

        <div className="dash-sheet-group">
          {parts.businessFromReceipts > 0 ? (
            <Row label="הכנסה מהעסק" sub="לפי קבלות החודש, מתווסף אוטומטית" value={fmt(parts.businessFromReceipts)} />
          ) : null}
          {savings > 0 ? <Row label="חיסכון חודשי" value={`− ${fmt(savings)}`} /> : null}
          <Row label="תקציב הוצאות חדש" sub="הכנסה פחות חיסכון" value={fmt(newLimit)} strong />
        </div>

        <p className="dash-sheet-note">
          הסכום מתעדכן בדשבורד, במסך התקציב ובצ׳אט.
        </p>

        {error ? <p className="dash-sheet-error" role="alert">{error}</p> : null}

        <button type="button" className="btn btn-primary dash-sheet-cta" onClick={() => void save()} disabled={busy}>
          {busy ? "שומר…" : "שמור"}
        </button>
      </div>
    </AppModal>
  );
}

export function BudgetUsageSheet(props: {
  open: boolean;
  onClose: () => void;
  summary: DashboardSummary;
}) {
  const d = props.summary.budgetDetails;
  const spent = d.expenseFromTransactions + d.expenseFromDocs;
  const carried = d.limitMonth && d.limitMonth !== d.month;
  const perDay = d.remaining != null && d.remaining > 0 && d.daysLeft > 0 ? d.remaining / d.daysLeft : 0;

  return (
    <AppModal open={props.open} onClose={props.onClose} title="איך מחושב ניצול התקציב">
      <div className="dash-sheet">
        <p className="dash-sheet-note">{props.summary.cycleLabel}</p>

        {d.limit ? (
          <>
            <div className="dash-sheet-hero">
              <span className={`dash-sheet-hero-value amount${d.rawPct > 100 ? " text-negative" : ""}`}>{d.rawPct}%</span>
              <span className="dash-sheet-hero-sub">
                {fmt(spent)} מתוך {fmt(d.limit)}
              </span>
              <div className="dash-sheet-bar" aria-hidden>
                <div className={`dash-sheet-bar-fill${d.rawPct > 100 ? " is-over" : ""}`} style={{ width: `${Math.min(100, d.rawPct)}%` }} />
              </div>
            </div>

            <div className="dash-sheet-group">
              <Row
                label="תקציב הוצאות"
                sub={carried ? `לא נשמר תקציב לחודש הזה, נלקח מ${monthName(d.limitMonth)}` : "נשמר במסך התקציב"}
                value={fmt(d.limit)}
              />
              <Row label="הוצאות מתנועות" sub={`${d.transactionCount} תנועות בחודש`} value={fmt(d.expenseFromTransactions)} />
              {d.expenseFromDocs > 0 ? <Row label="הוצאות מקבלות" value={fmt(d.expenseFromDocs)} /> : null}
              <Row label="סה״כ הוצאות" value={fmt(spent)} strong />
            </div>

            <div className="dash-sheet-group">
              <Row
                label={d.remaining != null && d.remaining < 0 ? "חריגה" : "נשאר להוציא"}
                value={fmt(Math.abs(d.remaining ?? 0))}
                tone={d.remaining != null && d.remaining < 0 ? "neg" : "pos"}
                strong
              />
              {d.daysLeft > 0 ? <Row label="ימים שנשארו בחודש" value={String(d.daysLeft)} /> : null}
              {perDay > 0 ? <Row label="אפשר להוציא ביום" value={fmt(perDay)} /> : null}
            </div>

            <p className="dash-sheet-note">
              ניצול = סה״כ הוצאות בחודש ÷ תקציב ההוצאות. התקציב הוא ההכנסה פחות החיסכון, כפי שנקבע במסך התקציב.
            </p>
          </>
        ) : (
          <p className="dash-sheet-note">
            עדיין לא נשמר תקציב. כנס למסך התקציב ושמור תקציב חודשי, או עדכן הכנסה בכרטיס ההכנסות.
          </p>
        )}
      </div>
    </AppModal>
  );
}
