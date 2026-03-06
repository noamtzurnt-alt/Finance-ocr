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
      take: props.showAll ? 100_000 : 50,
      select: { id: true, date: true, vendor: true, amount: true, currency: true, description: true, ocrStatus: true, ocrText: true },
    }),
    prisma.document.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  const sum = agg._sum.amount?.toString() ?? "0";

  return (
    <div className="card p-4">
      <div className="mb-3 text-sm text-zinc-600">
        סה״כ הוצאות (קבלות החזר מס) ({props.showAll ? "כל הזמן" : monthLabel(start)}): <span className="font-semibold text-zinc-900">{sum}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-3 py-2 text-right font-medium">תאריך</th>
              <th className="px-3 py-2 text-right font-medium">בית עסק</th>
              <th className="px-3 py-2 text-right font-medium">תיאור</th>
              <th className="px-3 py-2 text-right font-medium">סכום</th>
              <th className="px-3 py-2 text-right font-medium">OCR</th>
              <th className="px-3 py-2 text-right font-medium">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr>
                <td className="px-3 py-12 text-center text-zinc-600" colSpan={6}>
                  אין קבלות החזר מס עדיין. <Link className="underline" href="/receipts/upload">העלה קבלת החזר מס</Link>
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
                      <tr key={`m-${m}`} className="bg-zinc-50/60">
                        <td className="px-3 py-2 text-xs font-semibold text-zinc-700" colSpan={6}>
                          {monthLabel(dt)}
                        </td>
                      </tr>,
                    );
                  }
                  out.push(
                    <tr key={d.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                      <td className="px-3 py-2">{d.date.toISOString().slice(0, 10)}</td>
                      <td className="px-3 py-2">
                        <Link
                          className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2"
                          href={`/documents/${d.id}?from=receipts`}
                        >
                          {d.vendor}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{d.description ?? "—"}</td>
                      <td className="px-3 py-2">
                        {d.amount.toString()} <span className="text-xs text-zinc-600">{d.currency}</span>
                      </td>
                      <td className="px-3 py-2">
                        <OcrStatusCell
                          docId={d.id}
                          status={d.ocrStatus}
                          errorMessage={
                            d.ocrStatus === "failed" && d.ocrText
                              ? d.ocrText.startsWith("OCR job failed:")
                                ? d.ocrText.slice("OCR job failed:".length).trim().slice(0, 120)
                                : d.ocrText.slice(0, 120)
                              : null
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link className="btn" href={`/documents/${d.id}?from=receipts`}>
                          ערוך
                        </Link>
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

