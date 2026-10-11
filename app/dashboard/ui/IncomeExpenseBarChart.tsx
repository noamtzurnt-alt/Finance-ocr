"use client";

const HEIGHT = 200;
const BAR_WIDTH = 64;
const SCALE_MAX = 10_000;
const TICKS = [10_000, 7_500, 5_000, 2_500, 0];

function fmt(n: number) {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

function fmtTick(v: number) {
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
}

export default function IncomeExpenseBarChart(props: {
  income: number;
  expense: number;
  budgetLimit?: number;
  todayExpense?: number;
  cycleDayIndex?: number;
  cycleTotalDays?: number;
}) {
  const income = Math.max(0, props.income);
  const expense = Math.max(0, props.expense);
  const budgetLimit = Math.max(0, Number(props.budgetLimit) || 0);
  const todayExpense = Math.max(0, Number(props.todayExpense) || 0);
  const net = income - expense;
  const chartH = HEIGHT - 40;
  const dayOfMonth = props.cycleDayIndex || new Date().getDate();
  const daysInMonth =
    props.cycleTotalDays || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(daysInMonth - dayOfMonth, 0);

  const barHeight = (value: number) => {
    if (value <= 0) return 0;
    return Math.max(8, (value / SCALE_MAX) * chartH);
  };

  const incomeH = barHeight(income);
  const expenseH = barHeight(expense);
  const hasData = income > 0 || expense > 0;

  const expenseOfIncomePct = income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : 0;
  const savedPct = income > 0 ? Math.max(0, 100 - expenseOfIncomePct) : 0;
  const budgetUsedPct = budgetLimit > 0 ? Math.min(100, Math.round((expense / budgetLimit) * 100)) : 0;
  const dailyAvg = dayOfMonth > 0 ? Math.round(expense / dayOfMonth) : 0;
  const projectedMonth = dailyAvg * daysInMonth;
  const projectedOverBudget = budgetLimit > 0 && projectedMonth > budgetLimit;

  const bars = [
    {
      label: "הכנסות",
      value: income,
      height: incomeH,
      className: "ie-chart-bar--income",
    },
    {
      label: "הוצאות",
      value: expense,
      height: expenseH,
      className: "ie-chart-bar--expense",
    },
  ] as const;

  return (
    <div className="ie-chart-v2">
      <div className="ie-stat-grid">
        <div className="ie-stat-pill ie-stat-pill--income">
          <span className="ie-stat-pill-label">הכנסות</span>
          <span className="ie-stat-pill-value amount">{income > 0 ? `${fmt(income)} ₪` : "—"}</span>
        </div>
        <div className="ie-stat-pill ie-stat-pill--expense">
          <span className="ie-stat-pill-label">הוצאות</span>
          <span className="ie-stat-pill-value amount">{expense > 0 ? `${fmt(expense)} ₪` : "—"}</span>
        </div>
        <div className={`ie-stat-pill${net >= 0 ? " ie-stat-pill--positive" : " ie-stat-pill--negative"}`}>
          <span className="ie-stat-pill-label">יתרה</span>
          <span className="ie-stat-pill-value amount">
            {hasData ? `${net >= 0 ? "+" : ""}${fmt(net)} ₪` : "—"}
          </span>
        </div>
      </div>

      {income > 0 ? (
        <div className="ie-flow">
          <div className="ie-flow-head">
            <span>איך ההכנסה מתחלקת</span>
            <span className="ie-flow-pct">{savedPct}% נשמר</span>
          </div>
          <div className="ie-flow-track" role="img" aria-label={`${expenseOfIncomePct}% הוצאות, ${savedPct}% נשמר`}>
            <div className="ie-flow-expense goal-fill" style={{ width: `${Math.max(expenseOfIncomePct, expense > 0 ? 4 : 0)}%` }} />
            <div className="ie-flow-saved goal-fill" style={{ width: `${Math.max(savedPct, net > 0 ? 4 : 0)}%` }} />
          </div>
          <div className="ie-flow-legend">
            <span><i className="ie-legend-dot ie-legend-dot--expense" />הוצאות {expenseOfIncomePct}%</span>
            <span><i className="ie-legend-dot ie-legend-dot--saved" />נשמר {savedPct}%</span>
          </div>
        </div>
      ) : null}

      <div className="ie-chart-body" style={{ minHeight: HEIGHT }}>
        <div className="ie-chart-axis" aria-hidden>
          {TICKS.map((t) => (
            <span key={t} className="ie-chart-tick">{fmtTick(t)}</span>
          ))}
        </div>
        <div className="ie-chart-plot">
          <div className="ie-chart-grid" aria-hidden>
            {TICKS.map((t) => (
              <span key={t} className="ie-chart-grid-line" style={{ bottom: `${(t / SCALE_MAX) * chartH}px` }} />
            ))}
          </div>
          <div className="ie-chart-bars">
            {bars.map((bar) => (
              <div key={bar.label} className="ie-chart-bar-col">
                <div className="ie-chart-bar-stack" style={{ height: chartH }}>
                  {bar.value > 0 ? (
                    <span className="ie-chart-bar-value amount">{fmt(bar.value)} ₪</span>
                  ) : (
                    <span className="ie-chart-bar-value ie-chart-bar-value--empty">—</span>
                  )}
                  <div className={`ie-chart-bar bar-grow ${bar.className}`} style={{ width: BAR_WIDTH, height: bar.height }} />
                </div>
                <span className="ie-chart-bar-label">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ie-metrics-grid">
        <div className="ie-metric-card">
          <span className="ie-metric-label">ממוצע יומי</span>
          <strong className="ie-metric-value amount">{dailyAvg > 0 ? `${fmt(dailyAvg)} ₪` : "—"}</strong>
          <span className="ie-metric-sub">סה״כ הוצאות ÷ {dayOfMonth} ימים</span>
        </div>
        <div className="ie-metric-card">
          <span className="ie-metric-label">היום</span>
          <strong className="ie-metric-value amount">{todayExpense > 0 ? `${fmt(todayExpense)} ₪` : "—"}</strong>
          <span className="ie-metric-sub">הוצאות היום</span>
        </div>
        {budgetLimit > 0 ? (
          <div className={`ie-metric-card${budgetUsedPct >= 100 ? " is-warning" : ""}`}>
            <span className="ie-metric-label">תקציב חודשי</span>
            <strong className="ie-metric-value amount">{budgetUsedPct}%</strong>
            <div className="ie-metric-bar">
              <div className="ie-metric-bar-fill goal-fill" style={{ width: `${budgetUsedPct}%` }} />
            </div>
            <span className="ie-metric-sub">{fmt(expense)} / {fmt(budgetLimit)} ₪</span>
          </div>
        ) : (
          <div className="ie-metric-card">
            <span className="ie-metric-label">תחזית חודש</span>
            <strong className={`ie-metric-value amount${projectedOverBudget ? " text-negative" : ""}`}>
              {dailyAvg > 0 ? `${fmt(projectedMonth)} ₪` : "—"}
            </strong>
            <span className="ie-metric-sub">{daysLeft} ימים נותרו</span>
          </div>
        )}
      </div>
    </div>
  );
}
