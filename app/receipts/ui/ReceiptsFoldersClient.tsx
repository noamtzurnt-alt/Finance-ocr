"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MIN_EXPENSE_ARCHIVE_YEAR } from "@/app/lib/receipts/defaults";
import {
  readFoldersListCache,
  writeFoldersListCache,
  yearRangeFrom,
  type FolderSummary,
} from "@/app/lib/receipts/folder-cache";
import { archiveQueryString, hebrewMonthLabel } from "@/app/lib/receipts/year-date";
import ArchiveFilters from "./ArchiveFilters";

export default function ReceiptsFoldersClient(props: {
  userId: string;
  initialYear?: number;
  initialMonth?: number | null;
}) {
  const router = useRouter();
  const years = yearRangeFrom(MIN_EXPENSE_ARCHIVE_YEAR);
  const [year, setYear] = useState(props.initialYear ?? years[0] ?? MIN_EXPENSE_ARCHIVE_YEAR);
  const [month, setMonth] = useState<number | null>(props.initialMonth ?? null);
  const [folders, setFolders] = useState<FolderSummary[]>(() => {
    const cached = readFoldersListCache(
      props.userId,
      props.initialYear ?? years[0] ?? MIN_EXPENSE_ARCHIVE_YEAR,
      props.initialMonth ?? null,
    );
    return cached?.folders ?? [];
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const syncUrl = useCallback(
    (y: number, m: number | null) => {
      router.replace(`/receipts?${archiveQueryString(y, m)}`, { scroll: false });
    },
    [router],
  );

  const load = useCallback(
    async (y: number, m: number | null) => {
      setLoading(true);
      setError(null);
      try {
        const qs = archiveQueryString(y, m);
        const res = await fetch(`/api/receipts/folders?${qs}`);
        if (!res.ok) throw new Error("שגיאת טעינה");
        const data = (await res.json()) as { year: number; month: number | null; folders: FolderSummary[] };
        setFolders(data.folders);
        writeFoldersListCache(props.userId, {
          year: data.year,
          month: data.month,
          syncedAt: new Date().toISOString(),
          folders: data.folders,
        });
      } catch {
        setError("לא הצלחנו לטעון את התיקיות");
      } finally {
        setLoading(false);
      }
    },
    [props.userId],
  );

  useEffect(() => {
    void load(year, month);
    syncUrl(year, month);
  }, [year, month, load, syncUrl]);

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/receipts/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, year }),
      });
      const body = (await res.json()) as { error?: string; folder?: FolderSummary; docCount?: number };
      if (!res.ok) {
        setError(body.error ?? "שגיאה ביצירת קטגוריה");
        return;
      }
      const folder = body.folder!;
      setFolders((prev) => [...prev, { ...folder, docCount: body.docCount ?? 0 }]);
      setNewName("");
      setShowAdd(false);
    } catch {
      setError("שגיאה ביצירת קטגוריה");
    } finally {
      setAdding(false);
    }
  }

  const totalDocs = folders.reduce((s, f) => s + f.docCount, 0);
  const periodLabel = month ? `${hebrewMonthLabel(year, month)} ${year}` : String(year);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-orange-50 px-5 py-4">
        <div className="text-3xl">📂</div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-500">ארכיון הוצאות מוכרות · {periodLabel}</div>
          <div className="text-lg font-bold text-amber-800">
            {totalDocs} מסמכים · {folders.length} תיקיות
          </div>
        </div>
        <ArchiveFilters
          year={year}
          month={month}
          years={years}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading && folders.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-32 animate-pulse bg-zinc-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((f) => (
            <Link
              key={f.id}
              href={`/receipts/folder/${f.id}?${archiveQueryString(year, month)}`}
              className="card group flex flex-col gap-3 p-5 transition hover:border-amber-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-3xl" aria-hidden>
                  {f.icon}
                </span>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {f.docCount}
                </span>
              </div>
              <div>
                <div className="font-semibold text-zinc-900 group-hover:text-amber-800">{f.name}</div>
                <div className="mt-1 text-xs text-zinc-500">לחץ לפתיחה · גרור קבצים לתוך התיקייה</div>
              </div>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="card flex min-h-[8rem] flex-col items-center justify-center gap-2 border-dashed p-5 text-zinc-500 transition hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-800"
          >
            <span className="text-2xl">➕</span>
            <span className="text-sm font-medium">הוסף קטגוריה</span>
          </button>
        </div>
      )}

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <form
            onSubmit={addFolder}
            className="card w-full max-w-md space-y-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">קטגוריה חדשה</h2>
            <div>
              <label className="text-sm font-medium" htmlFor="folder-name">
                שם התיקייה
              </label>
              <input
                id="folder-name"
                className="field mt-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="לדוגמה: ייעוץ משפטי"
                autoFocus
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setShowAdd(false)} disabled={adding}>
                ביטול
              </button>
              <button type="submit" className="btn btn-primary" disabled={adding}>
                {adding ? "שומר..." : "הוסף"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
