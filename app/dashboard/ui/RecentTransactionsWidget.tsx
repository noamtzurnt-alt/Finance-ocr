import Link from "next/link";
import type { RecentTransactionItem } from "@/app/lib/dashboard/summary";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit" }).format(d);
}

export default function RecentTransactionsWidget(props: { items: RecentTransactionItem[] }) {
  return (
    <div className="card p-6 dash-enter" style={{ animationDelay: "320ms" }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>עסקאות אחרונות</h3>
        <Link href="/transactions" className="text-xs font-medium" style={{ color: "var(--brand)" }}>
          הצג הכל
        </Link>
      </div>
      {props.items.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>אין עדיין תנועות</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {props.items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>{t.vendor}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {fmtDate(t.date)}{t.categoryName ? ` · ${t.categoryName}` : ""}
                </p>
              </div>
              <span className="amount amount-negative shrink-0 text-sm">
                -{Math.round(Math.abs(t.amount)).toLocaleString()} ₪
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
