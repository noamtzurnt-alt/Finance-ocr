"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Category = { id: string; name: string };
type Item = {
  id: string;
  type: "expense" | "payment_receipt";
  date: string; // YYYY-MM-DD
  amount: string;
  currency: string;
  vendor: string;
  docNumber: string | null;
  categoryId: string | null;
  categoryName: string | null;
  fileName: string;
};

type Page = { items: Item[]; nextCursor: string | null };

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim()) sp.set(k, v.trim());
  }
  return sp.toString();
}

export default function DocumentsClient(props: { categories: Category[]; initial: Page }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "expense" | "payment_receipt">("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [page, setPage] = useState<Page>(props.initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFilters = useMemo(() => {
    return Boolean(q.trim() || type || categoryId || from || to);
  }, [q, type, categoryId, from, to]);

  const load = useCallback(async (append: boolean) => {
    setLoading(true);
    setError(null);

    const query = qs({
      q,
      type: type || undefined,
      categoryId: categoryId || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: "50",
      cursor: append ? page.nextCursor ?? undefined : undefined,
    });

    const res = await fetch(`/api/documents?${query}`);
    setLoading(false);
    if (!res.ok) {
      setError("לא הצלחתי לטעון מסמכים");
      return;
    }
    const body = (await res.json()) as Page;
    setPage((prev) =>
      append
        ? {
            items: [...prev.items, ...body.items],
            nextCursor: body.nextCursor,
          }
        : body,
    );
  }, [q, type, categoryId, from, to, page.nextCursor]);

  function reset() {
    setQ("");
    setType("");
    setCategoryId("");
    setFrom("");
    setTo("");
    void load(false);
  }

  const rows = page.items;

  const loadRef = useRef<(append: boolean) => void>(() => {});
  useEffect(() => {
    loadRef.current = (append: boolean) => {
      void load(append);
    };
  }, [load]);

  useEffect(() => {
    // Live updates: refresh list when any document changes (multi-device)
    const es = new EventSource("/api/stream/events");
    const onChanged = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadRef.current(false);
    };
    es.addEventListener("changed", onChanged);
    es.onerror = () => {
      // If SSE fails (corporate proxy etc), list still works manually.
    };
    return () => {
      es.removeEventListener("changed", onChanged);
      es.close();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="text-sm font-medium">חיפוש</label>
          <input
            className="field mt-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ספק / מספר מסמך / הערה / שם קובץ…"
          />
        </div>
        <div>
          <label className="text-sm font-medium">סוג</label>
          <select
            className="field mt-1"
            value={type}
            onChange={(e) => {
              const v = e.target.value;
              setType(v === "expense" || v === "payment_receipt" ? v : "");
            }}
          >
            <option value="">הכל</option>
            <option value="expense">הוצאות מוכרות (הוצאות)</option>
            <option value="payment_receipt">קבלות (הכנסות)</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">קטגוריה</label>
          <select className="field mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">הכל</option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end justify-end gap-2">
          <button type="button" className="btn" onClick={() => void load(false)} disabled={loading}>
            {loading ? "טוען…" : "חפש"}
          </button>
          <button type="button" className="btn" onClick={reset} disabled={loading || !hasFilters}>
            איפוס
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-sm font-medium">מתאריך</label>
          <input className="field mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">עד תאריך</label>
          <input className="field mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="sm:col-span-2 lg:col-span-2 flex items-end justify-between gap-2">
          <div className="text-sm text-zinc-600">
            מציג <span className="font-semibold text-zinc-900">{rows.length}</span>
            {page.nextCursor ? " (עוד קיימים…)" : ""}
          </div>
          <a className="btn btn-primary" href="/upload">
            העלאה חדשה
          </a>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-3 py-2 text-right font-medium">תאריך</th>
              <th className="px-3 py-2 text-right font-medium">ספק</th>
              <th className="px-3 py-2 text-right font-medium">סוג</th>
              <th className="px-3 py-2 text-right font-medium">קטגוריה</th>
              <th className="px-3 py-2 text-right font-medium">סכום</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-12 text-center text-zinc-600" colSpan={5}>
                  אין מסמכים לתצוגה. <a className="underline" href="/upload">העלה מסמך ראשון</a>
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="px-3 py-2">{d.date}</td>
                  <td className="px-3 py-2">
                    <a
                      className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2"
                      href={
                        d.type === "expense"
                          ? "/receipts"
                          : `/documents/${d.id}?from=payment-receipts`
                      }
                      title={d.fileName}
                    >
                      {d.vendor}
                    </a>
                    {d.docNumber ? <div className="mt-0.5 text-xs text-zinc-600">#{d.docNumber}</div> : null}
                  </td>
                  <td className="px-3 py-2">{d.type === "expense" ? "הוצאה" : "קבלה (הכנסה)"}</td>
                  <td className="px-3 py-2">{d.categoryName ?? ""}</td>
                  <td className="px-3 py-2">
                    {d.amount} <span className="text-xs text-zinc-600">{d.currency}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {page.nextCursor ? (
        <div className="flex items-center justify-center">
          <button type="button" className="btn" disabled={loading} onClick={() => void load(true)}>
            {loading ? "טוען…" : "טען עוד"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

