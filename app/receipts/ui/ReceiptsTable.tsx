import { prisma } from "@/app/lib/prisma";
import OcrStatusCell from "@/app/ui/OcrStatusCell";
import Link from "next/link";

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(d);
}

export default async function ReceiptsTable(props: { userId: string; showAll: boolean }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const where = props.showAll
    ? { userId: props.userId, type: "expense" as const }
    : { userId: props.userId, type: "expense" as const, date: { gte: start, lt: end } };

  const [docs, agg] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: props.showAll ? 3_000 : 50,
      select: { id: true, date: true, vendor: true, amount: true, currency: true, description: true, ocrStatus: true, ocrText: true },
    }),
    prisma.document.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  const sum = agg._sum.amount?.toString() ?? "0";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
        <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <svg viewBox="0 0 20 20" className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 10h10M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-500">סה״כ הוצאות (קבלות) · {props.showAll ? "כל הזמן" : monthLabel(start)}</div>
          <div className="text-xl font-bold tracking-tight text-amber-700">{sum} ₪</div>
        </div>
        <div className="mr-auto text-xs text-zinc-400">{docs.length} קבלות</div>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>בית עסק</th>
              <th>תיאור</th>
              <th>סכום</th>
              <th>OCR</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr>
                <td className="py-14 text-center text-zinc-400" colSpan={6}>
                  אין קבלות עדיין.{" "}
                  <Link className="font-semibold text-indigo-600 underline" href="/receipts/upload">העלה קבלה</Link>
                </td>
              </tr>
            ) : (
              (() => {
                const out: React.ReactNode[] = [];
                let lastMonth = "";
                for (const d of docs) {
                  const m = d.date.toISOString().slice(0, 7);
                  if (m !== lastMonth) {
                    lastMonth = m;
                    const dt = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1);
                    out.push(
                      <tr key={`m-${m}`} className="month-divider">
                        <td colSpan={6}>{monthLabel(dt)}</td>
                      </tr>,
                    );
                  }
                  out.push(
                    <tr key={d.id}>
                      <td className="text-zinc-500 text-xs">{d.date.toISOString().slice(0, 10)}</td>
                      <td>
                        <Link className="font-semibold text-indigo-600 hover:text-indigo-800"
                          href={`/documents/${d.id}?from=receipts`}>
                          {d.vendor}
                        </Link>
                      </td>
                      <td className="text-zinc-500">{d.description ?? "—"}</td>
                      <td>
                        <span className="font-semibold text-red-600">{d.amount.toString()}</span>
                        <span className="mr-1 text-xs text-zinc-400">{d.currency}</span>
                      </td>
                      <td>
                        <OcrStatusCell docId={d.id} status={d.ocrStatus}
                          errorMessage={d.ocrStatus === "failed" && d.ocrText
                            ? d.ocrText.startsWith("OCR job failed:")
                              ? d.ocrText.slice("OCR job failed:".length).trim().slice(0, 120)
                              : d.ocrText.slice(0, 120)
                            : null}
                        />
                      </td>
                      <td>
                        <Link className="btn text-xs" href={`/documents/${d.id}?from=receipts`}>ערוך</Link>
                      </td>
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
  );
}

