"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MIN_EXPENSE_ARCHIVE_YEAR } from "@/app/lib/receipts/defaults";
import { hebrewMonthLabel } from "@/app/lib/receipts/year-date";
import { expenseDateRange } from "@/app/lib/receipts/query-range";
import ArchiveFilters from "./ArchiveFilters";

type ExpenseDoc = {
  id: string;
  date: string;
  vendor: string;
  amount: string;
  currency: string;
  fileName: string;
  description?: string | null;
  docNumber?: string | null;
  sourceUrl?: string | null;
  needsReview?: boolean;
};

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "📄";
  if (/\.(jpe?g|png|gif|webp|heic)$/.test(lower)) return "🖼️";
  if (lower.endsWith(".html")) return "📧";
  return "📎";
}

export default function ReceiptsExpensesClient(props: {
  initialYear: number;
  initialMonth: number | null;
  initialQ?: string;
  initialFrom?: string;
  initialTo?: string;
  initialItems: ExpenseDoc[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRun = useRef(true);
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    const out: number[] = [];
    for (let i = y; i >= MIN_EXPENSE_ARCHIVE_YEAR; i--) out.push(i);
    return out;
  }, []);

  const [year, setYear] = useState(props.initialYear);
  const [month, setMonth] = useState<number | null>(props.initialMonth);
  const [q, setQ] = useState(props.initialQ ?? "");
  const [from, setFrom] = useState(props.initialFrom ?? "");
  const [to, setTo] = useState(props.initialTo ?? "");
  const [docs, setDocs] = useState<ExpenseDoc[]>(props.initialItems);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("type", "expense");
    params.set("limit", "200");
    if (q.trim()) params.set("q", q.trim());
    const range = expenseDateRange({ year, month, from: from || undefined, to: to || undefined });
    params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    return params.toString();
  }, [q, from, to, year, month]);

  const syncUrl = useCallback(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (month) p.set("month", String(month));
    p.set("year", String(year));
    router.replace(`/receipts?${p.toString()}`, { scroll: false });
  }, [router, q, from, to, year, month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents?${buildQuery()}`);
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { items: ExpenseDoc[] };
      setDocs(data.items ?? []);
    } catch {
      setError("לא הצלחנו לטעון את ההוצאות");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  async function deleteDoc(id: string) {
    if (!confirm("למחוק את ההוצאה לצמיתות?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("מחיקת ההוצאה נכשלה");
        return;
      }
      setDocs((current) => current.filter((doc) => doc.id !== id));
    } catch {
      setError("מחיקת ההוצאה נכשלה");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (isFirstRun.current) {
      // Initial data already came from the server (SSR) for the current URL params.
      isFirstRun.current = false;
      syncUrl();
      return;
    }
    void load();
    syncUrl();
  }, [load, syncUrl]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;
    if (!month) {
      setError("בחר חודש לפני העלאה ידנית");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("year", String(year));
      form.append("month", String(month));
      for (const f of list) form.append("files", f);
      const res = await fetch("/api/receipts/upload", { method: "POST", body: form });
      const data = (await res.json()) as { uploaded?: number; error?: string };
      if (!res.ok) {
        setError(data.error ?? "העלאה נכשלה");
        return;
      }
      setSyncMsg(`הועלו ${data.uploaded ?? 0} קבצים`);
      await load();
    } catch {
      setError("העלאה נכשלה");
    } finally {
      setUploading(false);
    }
  }

  const periodLabel = month ? `${hebrewMonthLabel(year, month)} ${year}` : String(year);
  const previewDoc = previewId ? docs.find((d) => d.id === previewId) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Single toolbar: period + count + actions + search */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 items-center rounded-xl bg-brand-50 px-3 text-sm font-bold text-brand-700">
              {periodLabel} · {docs.length} מסמכים
            </span>
          </div>
          <ArchiveFilters year={year} month={month} years={years} onYearChange={setYear} onMonthChange={setMonth} />
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "מעלה..." : "+ העלאה ידנית"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.html,image/*,application/pdf"
              onChange={(e) => {
                if (e.target.files) void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-3">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs text-zinc-500" htmlFor="expense-search">
              חיפוש
            </label>
            <input
              id="expense-search"
              className="field mt-1"
              placeholder="ספק, נושא, שם קובץ..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500" htmlFor="from-date">
              מתאריך
            </label>
            <input id="from-date" type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500" htmlFor="to-date">
              עד תאריך
            </label>
            <input id="to-date" type="date" className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="button" className="btn" onClick={() => void load()}>
            חפש
          </button>
        </div>
      </div>

      {syncMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{syncMsg}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="card">
        <table className="data-table w-full table-fixed">
          <thead>
            <tr>
              <th className="w-24">תאריך</th>
              <th className="w-40">ספק</th>
              <th>תיאור</th>
              <th className="w-[220px] text-left">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {loading && docs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-zinc-400">
                  טוען...
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-14 text-center text-zinc-400">
                  אין הוצאות בתקופה הזו. העלה קבצים עם ״העלאה ידנית״ למעלה.
                </td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr
                  key={d.id}
                  className="cursor-pointer"
                  title="לחיצה פותחת תצוגה מקדימה"
                  onClick={() => setPreviewId(d.id)}
                >
                  <td className="whitespace-nowrap text-xs text-zinc-500">{d.date}</td>
                  <td>
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="shrink-0">{fileIcon(d.fileName)}</span>
                      <span className="truncate" title={d.vendor}>
                        {d.vendor}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="block truncate text-sm text-zinc-500" title={d.description ?? ""}>
                      {d.description ?? ""}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <button type="button" className="btn btn-ghost text-xs" onClick={() => setPreviewId(d.id)}>
                        תצוגה
                      </button>
                      {d.sourceUrl ? (
                        <a
                          className="btn btn-ghost text-xs"
                          href={d.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          מקור
                        </a>
                      ) : null}
                      <a className="btn btn-ghost text-xs" href={`/api/documents/${d.id}/download`}>
                        הורדה
                      </a>
                      <button
                        type="button"
                        className="btn btn-danger text-xs"
                        disabled={deletingId === d.id}
                        onClick={() => void deleteDoc(d.id)}
                      >
                        {deletingId === d.id ? "מוחק..." : "מחק"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {previewDoc ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          onClick={() => setPreviewId(null)}
        >
          <div className="card flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <span className="min-w-0 truncate font-semibold" title={previewDoc.fileName}>
                {fileIcon(previewDoc.fileName)} {previewDoc.fileName}
              </span>
              <button type="button" className="btn text-sm" onClick={() => setPreviewId(null)}>
                ✕ סגור
              </button>
            </div>
            <iframe title="preview" className="flex-1 w-full bg-[var(--surface)]" src={`/api/documents/${previewDoc.id}/preview`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
