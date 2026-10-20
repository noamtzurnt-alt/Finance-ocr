"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardSummary } from "@/app/lib/dashboard/summary";
import { addMonths, recentMonthOptions } from "@/app/lib/budget/months";
import { useCountUp } from "@/app/lib/ui/use-count-up";
import { IconBank, IconBars, IconChevronLeft, IconChevronRight, IconInfo, IconKebab, IconPencil, IconWallet } from "@/app/ui/icons";
import { BudgetUsageSheet, IncomeEditSheet } from "./DashboardSheets";
import CategoryDonutChart from "./CategoryDonutChart";
import IncomeExpenseBarChart from "./IncomeExpenseBarChart";
import FinancialGoalsWidget from "./FinancialGoalsWidget";
import RecentTransactionsWidget from "./RecentTransactionsWidget";

type Summary = DashboardSummary;

function fmt(n: number) {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

function fmtMoney(n: number) {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

/** Keeps an optional leading minus and a single decimal separator. */
function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  const negative = cleaned.startsWith("-");
  const body = cleaned.replace(/-/g, "").replace(",", ".");
  const [whole, ...rest] = body.split(".");
  const fraction = rest.join("").slice(0, 2);
  const core = rest.length > 0 ? `${whole}.${fraction}` : whole;
  return negative ? `-${core}` : core;
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

function AnimatedAmount(props: { value: string; className?: string }) {
  const n = useCountUp(Number(props.value) || 0);
  return <span className={props.className}>{fmt(n)} ₪</span>;
}

function WalletIcon() {
  return <IconWallet className="h-5 w-5" />;
}

function ChartIcon() {
  return <IconBars className="h-5 w-5" />;
}

function BankIcon() {
  return <IconBank className="h-5 w-5" />;
}

function Kebab({ href }: { href: string }) {
  return (
    <Link href={href} className="card-kebab" aria-label="עוד">
      <IconKebab className="h-4 w-4" />
    </Link>
  );
}

export default function DashboardCards(props: {
  initialSummary: Summary;
  initialCategoryBudgets: Record<string, number>;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(props.initialSummary.month);
  const [data, setData] = useState<Summary>(props.initialSummary);
  const [monthLoading, setMonthLoading] = useState(false);
  const [error, setError] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [cashEditing, setCashEditing] = useState(false);
  const [cashDraft, setCashDraft] = useState("");
  const [cashBusy, setCashBusy] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);
  const requestId = useRef(0);
  const loadedMonth = useRef(props.initialSummary.month);
  loadedMonth.current = data.month;
  const categoryBudgets = props.initialCategoryBudgets;
  const monthOptions = useMemo(
    () => recentMonthOptions(data.currentMonth || props.initialSummary.currentMonth),
    [data.currentMonth, props.initialSummary.currentMonth],
  );
  const oldestMonth = monthOptions[monthOptions.length - 1]?.value;
  const shownMonthLabel = data.month === month ? data.cycleLabel : (monthOptions.find((o) => o.value === month)?.label ?? month);

  async function refreshNow() {
    const my = ++requestId.current;
    try {
      const res = await fetch(`/api/dashboard/summary?month=${encodeURIComponent(month)}`, { cache: "no-store" });
      if (res.ok && my === requestId.current) setData((await res.json()) as Summary);
    } catch {
      /* the 20s poll will catch up */
    }
    router.refresh();
  }

  function goMonth(next: string | null) {
    if (!next || next === month) return;
    if (oldestMonth && next < oldestMonth) return;
    if (next > (data.currentMonth || props.initialSummary.currentMonth)) return;
    setMonth(next);
  }

  function startCashEdit() {
    const current = data.checkingBalance != null ? String(Number(data.checkingBalance)) : "";
    setCashDraft(current);
    setCashError(null);
    setCashEditing(true);
  }

  async function saveCash() {
    const raw = cashDraft.trim();
    if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
      setCashError("הזן מספר");
      return;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < -100_000_000 || amount > 100_000_000) {
      setCashError("הזן מספר עד 100,000,000");
      return;
    }
    setCashBusy(true);
    setCashError(null);
    try {
      const res = await fetch("/api/dashboard/checking-balance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const body = (await res.json().catch(() => null)) as { checkingBalance?: string; error?: string } | null;
      if (!res.ok || !body?.checkingBalance) {
        setCashError(body?.error ?? "השמירה נכשלה. נסה שוב.");
        return;
      }
      requestId.current += 1;
      setData((prev) => ({ ...prev, checkingBalance: body.checkingBalance ?? prev.checkingBalance }));
      setCashEditing(false);
      router.refresh();
    } catch {
      setCashError("אין חיבור לרשת");
    } finally {
      setCashBusy(false);
    }
  }

  useEffect(() => {
    if (props.initialSummary.month === month) setData(props.initialSummary);
  }, [props.initialSummary, month]);

  useEffect(() => {
    let cancelled = false;
    if (month !== loadedMonth.current) setMonthLoading(true);

    const pull = async () => {
      const my = ++requestId.current;
      try {
        const res = await fetch(`/api/dashboard/summary?month=${encodeURIComponent(month)}`, { cache: "no-store" });
        if (!res.ok || cancelled || my !== requestId.current) return;
        setData((await res.json()) as Summary);
      } catch {
        /* ignore transient network errors */
      } finally {
        if (!cancelled && my === requestId.current) setMonthLoading(false);
      }
    };

    const onVis = () => {
      if (!document.hidden) void pull();
    };

    void pull();
    const interval = window.setInterval(() => {
      if (!document.hidden) void pull();
    }, 20_000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [month]);

  const checkingN = data.checkingBalance != null ? Number(data.checkingBalance) : null;
  const incomeN = Number(data.income) || 0;
  const expenseN = Number(data.expense) || 0;
  const savedPct = incomeN > 0 ? Math.max(0, Math.round(((incomeN - expenseN) / incomeN) * 100)) : 0;
  const budgetPctLabel = data.budgetLimit ? `${data.pct}%` : "—";
  const dayOfMonth = Math.max(data.cycleDayIndex || new Date().getDate(), 1);
  const cardCharges = data.cardCharges ?? [];
  const cardChargesTotal = cardCharges.reduce((sum, c) => sum + c.amount, 0);
  const cardLeftAfter = cardCharges.length && incomeN > 0 ? incomeN - cardChargesTotal : null;

  const topCategory = useMemo(() => {
    const items = [...data.categoryBreakdown].sort((a, b) => b.amount - a.amount);
    if (!items[0] || expenseN <= 0) return null;
    return {
      name: items[0].category,
      amount: items[0].amount,
      pct: Math.round((items[0].amount / expenseN) * 100),
    };
  }, [data.categoryBreakdown, expenseN]);

  const dailyAvgExpense = useMemo(() => {
    if (expenseN <= 0) return 0;
    return Math.round(expenseN / dayOfMonth);
  }, [expenseN, dayOfMonth]);

  if (error) {
    return (
      <div className="card p-5 text-sm" style={{ color: "var(--negative)" }}>
        שגיאה בטעינת הנתונים.{" "}
        <button className="font-semibold underline" onClick={() => { setError(false); router.refresh(); }}>
          נסה שוב
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6 dash-enter">
        <div className="card-head">
          <h2>סקירה פיננסית מהירה</h2>
        </div>

        <div className="month-nav" role="group" aria-label="בחירת חודש">
          <button
            type="button"
            className="month-nav-btn"
            onClick={() => goMonth(addMonths(month, -1))}
            disabled={!oldestMonth || month <= oldestMonth}
            aria-label="חודש קודם"
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
          <label className="month-nav-current">
            <span className="month-nav-face">{shownMonthLabel}</span>
            <select
              className="month-nav-select"
              value={month}
              aria-label="בחר חודש"
              onChange={(e) => goMonth(e.target.value)}
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="month-nav-btn"
            onClick={() => goMonth(addMonths(month, 1))}
            disabled={month >= (data.currentMonth || month)}
            aria-label="חודש הבא"
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {cashEditing ? (
          <form
            className="checking-bar"
            onSubmit={(e) => {
              e.preventDefault();
              void saveCash();
            }}
          >
            <span className="metric-icon" aria-hidden><BankIcon /></span>
            <label className="checking-bar-main">
              <span className="metric-label">כסף בעו״ש</span>
              <span className="checking-input-line">
                <input
                  className="checking-input amount"
                  inputMode="decimal"
                  dir="ltr"
                  value={cashDraft}
                  onChange={(e) => {
                    setCashDraft(sanitizeAmount(e.target.value));
                    setCashError(null);
                  }}
                  placeholder="0"
                  aria-label="סכום בעו״ש"
                  autoFocus
                />
                <span className="checking-input-unit">₪</span>
              </span>
            </label>
            <div className="checking-actions">
              <button
                type="button"
                className="checking-cancel"
                onClick={() => {
                  setCashEditing(false);
                  setCashError(null);
                }}
              >
                ביטול
              </button>
              <button type="submit" className="btn btn-primary checking-save" disabled={cashBusy}>
                {cashBusy ? "שומר…" : "שמור"}
              </button>
            </div>
          </form>
        ) : (
          <div className={`checking-bar${checkingN != null && checkingN < 0 ? " is-negative" : ""}`}>
            <span className="metric-icon" aria-hidden><BankIcon /></span>
            <div className="checking-bar-main">
              <div className="metric-label">כסף בעו״ש</div>
              <div className={`metric-value amount${checkingN != null && checkingN < 0 ? " amount-negative" : ""}`}>
                {checkingN == null ? <span className="checking-empty">הזן סכום</span> : `${checkingN < 0 ? "−" : ""}${fmtMoney(Math.abs(checkingN))} ₪`}
              </div>
              <p className="checking-note">הסכום שיש לך בחשבון עכשיו. אפשר לעדכן מתי שרוצים.</p>
            </div>
            <button type="button" className="metric-action" onClick={startCashEdit} aria-label="עריכת יתרת עו״ש">
              <IconPencil className="h-5 w-5" />
            </button>
          </div>
        )}
        {cashError ? <p className="checking-error" role="alert">{cashError}</p> : null}

        <div className={monthLoading ? "dash-month-body is-loading" : "dash-month-body"}>
        <div className="overview-grid">
          <div className="metric-tile metric-tile-hero">
            <span className="metric-icon"><WalletIcon /></span>
            <div className="min-w-0">
              <div className="metric-label">יתרה חודשית</div>
              <div className="metric-value">
                <AnimatedAmount value={data.net} />
              </div>
            </div>
          </div>

          <div className="metric-tile">
            <span className="metric-icon"><WalletIcon /></span>
            <div className="min-w-0">
              <div className="metric-label">הוצאות</div>
              <div className="metric-value">
                <AnimatedAmount value={data.expense} />
              </div>
            </div>
          </div>

          <div className="metric-tile">
            <span className="metric-icon"><ChartIcon /></span>
            <div className="min-w-0 flex-1">
              <div className="metric-label">ניצול תקציב</div>
              <div className="metric-value">{budgetPctLabel}</div>
            </div>
            <button
              type="button"
              className="metric-action"
              onClick={() => setUsageOpen(true)}
              aria-label="איך מחושב ניצול התקציב"
            >
              <IconInfo className="h-5 w-5" />
            </button>
          </div>

          <div className="metric-tile">
            <span className="metric-icon"><BankIcon /></span>
            <div className="min-w-0 flex-1">
              <div className="metric-label">הכנסות</div>
              <div className="metric-value">
                <AnimatedAmount value={data.income} />
              </div>
            </div>
            {data.isCurrentMonth ? (
              <button
                type="button"
                className="metric-action"
                onClick={() => setIncomeOpen(true)}
                aria-label="עריכת הכנסה חודשית"
              >
                <IconPencil className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        {incomeOpen ? (
          <IncomeEditSheet open onClose={() => setIncomeOpen(false)} summary={data} onSaved={() => void refreshNow()} />
        ) : null}
        <BudgetUsageSheet open={usageOpen} onClose={() => setUsageOpen(false)} summary={data} />

        {cardCharges.length ? (
          <div className="insight-cards">
            {cardCharges.map((charge) => (
              <div
                key={charge.card ?? "main"}
                className={`insight-card${cardLeftAfter !== null && cardLeftAfter < 0 ? " insight-card--danger" : " insight-card--accent"}`}
              >
                <span className="insight-card-label">
                  {charge.card ? `חיוב כרטיס ${charge.card}` : "חיוב אשראי"} ב־{shortDate(charge.chargeDate)}
                </span>
                <strong className="amount">{fmt(charge.amount)} ₪</strong>
                <span>
                  {charge.count} קניות
                  {charge.confirmedCount > 0 && charge.estimatedCount === 0
                    ? " (תאריך חיוב מאושר מהדף)"
                    : charge.confirmedCount > 0
                      ? ` (${charge.estimatedCount} בהערכה, מ־${shortDate(charge.fromDate)})`
                      : ` מ־${shortDate(charge.fromDate)} (הערכה)`}{" "}
                  · {charge.daysUntil === 0 ? "יורד היום" : `בעוד ${charge.daysUntil} ימים`}
                </span>
              </div>
            ))}
            {cardLeftAfter !== null ? (
              <div className={`insight-card${cardLeftAfter < 0 ? " insight-card--danger" : " insight-card--positive"}`}>
                <span className="insight-card-label">
                  {cardCharges.length > 1 ? "נשאר מההכנסה אחרי החיובים" : "נשאר מההכנסה אחרי החיוב"}
                </span>
                <strong className="amount">{fmt(cardLeftAfter)} ₪</strong>
                <span>
                  {cardLeftAfter < 0
                    ? "החיובים גבוהים מההכנסה של החודש"
                    : cardCharges.length > 1
                      ? "הכנסת החודש פחות החיובים הקרובים"
                      : "הכנסת החודש פחות החיוב הקרוב"}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      </section>

      <div className={`grid gap-6 xl:grid-cols-[1.15fr_1fr_0.95fr]${monthLoading ? " dash-month-body is-loading" : ""}`}>
        <section className="card flex flex-col p-5 sm:p-6 dash-enter" style={{ animationDelay: "80ms" }}>
          <div className="card-head">
            <h3>גרפים ותובנות</h3>
            <Kebab href="/transactions" />
          </div>
          <CategoryDonutChart
            items={data.categoryBreakdown}
            categoryBudgets={categoryBudgets}
            month={data.month}
            dayCount={dayOfMonth}
          />
          <div className="insight-cards">
            {topCategory ? (
              <>
                <div className="insight-card insight-card--accent">
                  <span className="insight-card-label">קטגוריה מובילה</span>
                  <strong>{topCategory.name}</strong>
                  <span>{fmt(topCategory.amount)} ₪ · {topCategory.pct}%</span>
                </div>
                <div className="insight-card">
                  <span className="insight-card-label">ממוצע יומי</span>
                  <strong className="amount">{fmt(dailyAvgExpense)} ₪</strong>
                  <span>הוצאה ליום · לפי {dayOfMonth} ימים החודש</span>
                </div>
              </>
            ) : (
              <p className="insight">אין מספיק הוצאות בחודש הזה כדי לבנות תובנה.</p>
            )}
          </div>
        </section>

        <section className="card flex flex-col p-5 sm:p-6 dash-enter" style={{ animationDelay: "140ms" }}>
          <div className="card-head">
            <h3>הכנסות מול הוצאות</h3>
            <Kebab href="/transactions" />
          </div>
          <IncomeExpenseBarChart
            income={incomeN}
            expense={expenseN}
            budgetLimit={Number(data.budgetLimit) || 0}
            todayExpense={Number(data.todayExpense) || 0}
            cycleDayIndex={data.cycleDayIndex}
            cycleTotalDays={data.cycleTotalDays}
            showToday={data.isCurrentMonth}
          />
          <div className="insight-cards">
            {incomeN > 0 ? (
              expenseN > incomeN ? (
                <div className="insight-card insight-card--danger">
                  <span className="insight-card-label">חריגה מההכנסה</span>
                  <strong className="amount">{fmt(expenseN - incomeN)} ₪</strong>
                  <span>הוצאת יותר ממה שנכנס החודש</span>
                </div>
              ) : (
                <div className="insight-card insight-card--positive">
                  <span className="insight-card-label">חיסכון החודש</span>
                  <strong className="amount">{fmt(incomeN - expenseN)} ₪</strong>
                  <span>{savedPct}% מההכנסה נשמר</span>
                </div>
              )
            ) : (
              <p className="insight">הגדר הכנסה כדי לראות כמה נשמר החודש.</p>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <FinancialGoalsWidget categoryBreakdown={data.categoryBreakdown} categoryBudgets={categoryBudgets} />
          <RecentTransactionsWidget items={data.recentTransactions} />
        </div>
      </div>
    </div>
  );
}
