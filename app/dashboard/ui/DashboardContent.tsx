import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import DashboardCards from "./DashboardCards";

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(d);
}

export default async function DashboardContent(props: { userId: string; now: Date }) {
  const start = new Date(props.now.getFullYear(), props.now.getMonth(), 1);
  const end = new Date(props.now.getFullYear(), props.now.getMonth() + 1, 1);
  const month = `${props.now.getFullYear()}-${String(props.now.getMonth() + 1).padStart(2, "0")}`;

  const [budget, recentTx, docSums, txSums] = await Promise.all([
    prisma.budget.findUnique({
      where: { userId_month: { userId: props.userId, month } },
      select: { expenseLimit: true },
    }),
    prisma.transaction.findMany({
      where: { userId: props.userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    // Documents: income (חשבוניות) + expense (קבלות החזר מס)
    prisma.document.groupBy({
      by: ["type"],
      where: { userId: props.userId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    // Transactions: expenses this month
    prisma.transaction.aggregate({
      where: { userId: props.userId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  // הכנסות = חשבוניות (income documents) בלבד
  const incomeFromDocs = Number(docSums.find((s) => s.type === "income")?._sum.amount ?? 0);
  // הוצאות = קבלות החזר מס (expense docs) + תנועות (transactions)
  const expenseFromDocs = Number(docSums.find((s) => s.type === "expense")?._sum.amount ?? 0);
  const expenseFromTx = Number(txSums._sum.amount ?? 0);
  const totalExpense = (expenseFromDocs + expenseFromTx).toFixed(2);
  const income = incomeFromDocs.toFixed(2);
  const net = (incomeFromDocs - expenseFromDocs - expenseFromTx).toFixed(2);

  const budgetLimit = budget?.expenseLimit?.toString() ?? "";
  const pct =
    budgetLimit && Number(budgetLimit) > 0
      ? Math.min(100, Math.round((Number(totalExpense) / Number(budgetLimit)) * 100))
      : 0;

  return (
    <>
      <DashboardCards
        income={income}
        expense={totalExpense}
        net={net}
        budgetLimit={budgetLimit}
        pct={pct}
      />

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">10 תנועות אחרונות</div>
            <div className="mt-0.5 text-xs text-zinc-600">סיכום קצר (פירוט מלא במסך תנועות אחרונות)</div>
          </div>
          <Link className="btn" href="/transactions">
            לכל התנועות
          </Link>
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
              {recentTx.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-zinc-600" colSpan={4}>
                    אין תנועות עדיין. <Link className="underline" href="/transactions">הוסף תנועה</Link>
                  </td>
                </tr>
              ) : (
                (() => {
                  const out: React.ReactNode[] = [];
                  let lastMonth = "";
                  for (const t of recentTx) {
                    const m = t.date.toISOString().slice(0, 7);
                    if (m !== lastMonth) {
                      lastMonth = m;
                      const dt = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1);
                      out.push(
                        <tr key={`m-${m}`} className="bg-zinc-50/60">
                          <td className="px-3 py-2 text-xs font-semibold text-zinc-700" colSpan={4}>
                            {monthLabel(dt)}
                          </td>
                        </tr>,
                      );
                    }
                    out.push(
                      <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                        <td className="px-3 py-2">{t.date.toISOString().slice(0, 10)}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-zinc-900">{t.vendor}</span>
                          {t.description ? <div className="mt-0.5 text-xs text-zinc-600">{t.description}</div> : null}
                        </td>
                        <td className="px-3 py-2">
                          {t.amount.toString()} <span className="text-xs text-zinc-600">{t.currency}</span>
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
