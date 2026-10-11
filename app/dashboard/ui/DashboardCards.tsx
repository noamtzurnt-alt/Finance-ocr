"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardSummary } from "@/app/lib/dashboard/summary";
import { useCountUp } from "@/app/lib/ui/use-count-up";
import { IconBank, IconBars, IconInfo, IconKebab, IconPencil, IconWallet } from "@/app/ui/icons";
import { BudgetUsageSheet, IncomeEditSheet } from "./DashboardSheets";
import CategoryDonutChart from "./CategoryDonutChart";
import IncomeExpenseBarChart from "./IncomeExpenseBarChart";
import FinancialGoalsWidget from "./FinancialGoalsWidget";
import RecentTransactionsWidget from "./RecentTransactionsWidget";

type Summary = DashboardSummary;

function fmt(n: number) {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
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
  const [data, setData] = useState<Summary>(props.initialSummary);
  const [error, setError] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const categoryBudgets = props.initialCategoryBudgets;

  async function refreshNow() {
    try {
      const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as Summary);
    } catch {
      /* the 20s poll will catch up */
    }
    router.refresh();
  }

  useEffect(() => {
    setData(props.initialSummary);
  }, [props.initialSummary]);

  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as Summary;
        if (!cancelled) setData(next);
      } catch {
        /* ignore transient network errors */
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
  }, []);

  const incomeN = Number(data.income) || 0;
  const expenseN = Number(data.expense) || 0;
  const savedPct = incomeN > 0 ? Math.max(0, Math.round(((incomeN - expenseN) / incomeN) * 100)) : 0;
  const budgetPctLabel = data.budgetLimit ? `${data.pct}%` : "—";
  const dayOfMonth = Math.max(data.cycleDayIndex || new Date().getDate(), 1);
  const cardLeftAfter = data.cardCharge && incomeN > 0 ? incomeN - data.cardCharge.amount : null;

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
          {data.cycleLabel ? (
            <span className="text-xs" style={{ color: "var(--muted)" }}>{data.cycleLabel}</span>
          ) : null}
        </div>

        <div className="overview-grid">
          <div className="metric-tile metric-tile-hero">
            <span className="metric-icon"><WalletIcon /></span>
            <div className="min-w-0">
              <div className="metric-label">יתרה</div>
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
            <button
              type="button"
              className="metric-action"
              onClick={() => setIncomeOpen(true)}
              aria-label="עריכת הכנסה חודשית"
            >
              <IconPencil className="h-5 w-5" />
            </button>
          </div>
        </div>

        {incomeOpen ? (
          <IncomeEditSheet open onClose={() => setIncomeOpen(false)} summary={data} onSaved={() => void refreshNow()} />
        ) : null}
        <BudgetUsageSheet open={usageOpen} onClose={() => setUsageOpen(false)} summary={data} />

        {data.cardCharge ? (
          <div className="insight-cards">
            <div className={`insight-card${cardLeftAfter !== null && cardLeftAfter < 0 ? " insight-card--danger" : " insight-card--accent"}`}>
              <span className="insight-card-label">חיוב אשראי ב־{shortDate(data.cardCharge.chargeDate)}</span>
              <strong className="amount">{fmt(data.cardCharge.amount)} ₪</strong>
              <span>
                {data.cardCharge.count} קניות מ־{shortDate(data.cardCharge.fromDate)} ·{" "}
                {data.cardCharge.daysUntil === 0 ? "יורד היום" : `בעוד ${data.cardCharge.daysUntil} ימים`}
              </span>
            </div>
            {cardLeftAfter !== null ? (
              <div className={`insight-card${cardLeftAfter < 0 ? " insight-card--danger" : " insight-card--positive"}`}>
                <span className="insight-card-label">נשאר מההכנסה אחרי החיוב</span>
                <strong className="amount">{fmt(cardLeftAfter)} ₪</strong>
                <span>{cardLeftAfter < 0 ? "החיוב גבוה מההכנסה של החודש" : "הכנסת החודש פחות החיוב הקרוב"}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr_0.95fr]">
        <section className="card flex flex-col p-5 sm:p-6 dash-enter" style={{ animationDelay: "80ms" }}>
          <div className="card-head">
            <h3>גרפים ותובנות</h3>
            <Kebab href="/transactions" />
          </div>
          <CategoryDonutChart items={data.categoryBreakdown} categoryBudgets={categoryBudgets} />
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
              <p className="insight">עדיין אין מספיק הוצאות החודש כדי לבנות תובנה.</p>
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
