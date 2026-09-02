"use client";

const HEIGHT = 160;
const BAR_WIDTH = 72;

export default function IncomeExpenseBarChart(props: { income: number; expense: number }) {
  const max = Math.max(1, props.income, props.expense);
  const incomeH = Math.max(4, (props.income / max) * (HEIGHT - 28));
  const expenseH = Math.max(4, (props.expense / max) * (HEIGHT - 28));

  const bars = [
    { label: "הכנסות", value: props.income, height: incomeH, color: "var(--brand)" },
    { label: "הוצאות", value: props.expense, height: expenseH, color: "var(--chart-6)" },
  ];

  return (
    <div className="flex items-end justify-center gap-10" style={{ height: HEIGHT }}>
      {bars.map((bar) => (
        <div key={bar.label} className="flex flex-col items-center gap-2">
          <span className="amount text-sm" style={{ color: "var(--foreground)" }}>
            {Math.round(bar.value).toLocaleString()} ₪
          </span>
          <div
            style={{
              width: BAR_WIDTH,
              height: bar.height,
              background: bar.color,
              borderRadius: "0.9rem",
              transition: "height 400ms var(--ease-out-strong)",
            }}
          />
          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            {bar.label}
          </span>
        </div>
      ))}
    </div>
  );
}
