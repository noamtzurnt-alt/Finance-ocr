import Link from "next/link";
import ImportStatementCard from "@/app/transactions/ui/ImportStatementCard";
import type { RecentTransactionItem } from "@/app/lib/dashboard/summary";
import { categoryColor } from "@/app/lib/ui/category-color";
import { IconKebab } from "@/app/ui/icons";

const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יונ׳", "יול׳", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

function dateParts(iso: string) {
  const d = new Date(iso);
  return { day: String(d.getDate()), month: MONTHS[d.getMonth()] ?? "" };
}

function recency(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

function fmtAmount(n: number) {
  return `${Math.round(Math.abs(n)).toLocaleString("he-IL")} ₪`;
}

export default function RecentTransactionsWidget(props: { items: RecentTransactionItem[]; onImported?: () => void }) {
  return (
    <div className="card p-5 sm:p-6 dash-enter" style={{ animationDelay: "200ms" }}>
      <div className="card-head">
        <div>
          <h3>תנועות אחרונות</h3>
          {props.items.length > 0 ? (
            <p className="recent-tx-sub">{props.items.length} תנועות אחרונות</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ImportStatementCard onImported={() => props.onImported?.()} />
          <Link href="/transactions" className="card-kebab" aria-label="כל התנועות">
            <IconKebab className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {props.items.length === 0 ? (
        <div className="recent-tx-empty">
          <p className="recent-tx-empty-title">אין תנועות בחודש הזה</p>
          <p className="recent-tx-empty-sub">תנועות מהחודש שנבחר יופיעו כאן</p>
          <Link href="/transactions" className="btn btn-primary mt-3 text-xs">
            לעמוד התנועות
          </Link>
        </div>
      ) : (
        <div className="recent-tx-list">
          <div className="recent-tx-columns" aria-hidden>
            <span>תאריך</span>
            <span>תנועה</span>
            <span>סכום</span>
          </div>

          <ul className="recent-tx-rows">
            {props.items.map((t) => {
              const { day, month } = dateParts(t.date);
              const category = t.categoryName ?? "ללא קטגוריה";
              const dotColor = categoryColor(category);

              return (
                <li key={t.id}>
                  <Link href="/transactions" className="recent-tx-row">
                    <div className="date-badge" aria-label={`תאריך ${day} ${month}`}>
                      <span className="date-badge-day">{day}</span>
                      <span className="date-badge-month">{month}</span>
                    </div>

                    <div className="recent-tx-main">
                      <p className="recent-tx-vendor">{t.vendor}</p>
                      <div className="recent-tx-meta">
                        <span className="recent-tx-category">
                          <span className="cat-dot" style={{ background: dotColor }} />
                          {category}
                        </span>
                        <span className="recent-tx-recency">{recency(t.date)}</span>
                      </div>
                    </div>

                    <div className="recent-tx-amount amount">{fmtAmount(t.amount)}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
