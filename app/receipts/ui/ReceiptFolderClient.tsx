"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MIN_EXPENSE_ARCHIVE_YEAR } from "@/app/lib/receipts/defaults";
import {
  readFolderDetailCache,
  writeFolderDetailCache,
  yearRangeFrom,
  type FolderDocument,
} from "@/app/lib/receipts/folder-cache";
import { archiveQueryString, hebrewMonthLabel } from "@/app/lib/receipts/year-date";
import ArchiveFilters from "./ArchiveFilters";
import ReceiptUploadMonthModal, { type PendingReceiptUpload } from "./ReceiptUploadMonthModal";

type UploadItem = {
  fileName: string;
  status: "pending" | "uploading" | "done" | "error";
  message?: string;
  docId?: string;
};

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.includes("pdf")) return "📄";
  return "📎";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReceiptFolderClient(props: {
  userId: string;
  folderId: string;
  year: number;
  month: number | null;
  folderName: string;
  folderIcon: string;
}) {
  const router = useRouter();
  const years = yearRangeFrom(MIN_EXPENSE_ARCHIVE_YEAR);
  const inputRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState(props.year);
  const [month, setMonth] = useState<number | null>(props.month);
  const [documents, setDocuments] = useState<FolderDocument[]>(() => {
    const cached = readFolderDetailCache(props.userId, props.folderId, props.year, props.month);
    return cached?.documents ?? [];
  });
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<FolderDocument | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingReceiptUpload[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = archiveQueryString(year, month);
      const res = await fetch(`/api/receipts/folders/${props.folderId}?${qs}`);
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as {
        folder: { id: string; name: string; icon: string };
        documents: FolderDocument[];
      };
      setDocuments(data.documents);
      writeFolderDetailCache(props.userId, {
        folderId: props.folderId,
        year,
        month,
        syncedAt: new Date().toISOString(),
        folder: data.folder,
        documents: data.documents,
      });
    } catch {
      setError("לא הצלחנו לטעון את המסמכים");
    } finally {
      setLoading(false);
    }
  }, [props.folderId, props.userId, year, month]);

  useEffect(() => {
    void load();
    router.replace(`/receipts/folder/${props.folderId}?${archiveQueryString(year, month)}`, {
      scroll: false,
    });
  }, [load, year, month, props.folderId, router]);

  function queueFilesForMonthPick(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;
    setError(null);
    setPendingUpload(list.map((file) => ({ file, month: null })));
  }

  async function uploadWithMonths(items: Array<{ file: File; month: number }>) {
    if (items.length === 0) return;

    setUploading(true);
    setQueue(items.map((i) => ({ fileName: i.file.name, status: "uploading" as const })));

    try {
      const outcomes = await Promise.all(
        items.map(async (item) => {
          const form = new FormData();
          form.append("year", String(year));
          form.append("month", String(item.month));
          form.append("files", item.file);

          try {
            const res = await fetch(`/api/receipts/folders/${props.folderId}/upload`, {
              method: "POST",
              body: form,
            });
            const body = (await res.json()) as {
              results?: Array<
                | { ok: true; id: string; fileName: string }
                | { ok: false; fileName: string; error: string; docId?: string }
              >;
              error?: string;
            };

            if (!res.ok) {
              return { fileName: item.file.name, status: "error" as const, message: body.error ?? "נכשל" };
            }

            const r = body.results?.[0];
            if (r?.ok) {
              return { fileName: r.fileName, status: "done" as const, docId: r.id };
            }
            if (r && !r.ok) {
              return {
                fileName: r.fileName,
                status: "error" as const,
                message: r.error === "duplicate" ? "כבר קיים" : r.error,
                docId: r.docId,
              };
            }
            return { fileName: item.file.name, status: "error" as const, message: "נכשל" };
          } catch {
            return { fileName: item.file.name, status: "error" as const, message: "נכשל" };
          }
        }),
      );

      setQueue(outcomes);
      setPendingUpload(null);
      await load();
      router.refresh();
    } catch {
      setError("שגיאת העלאה");
    } finally {
      setUploading(false);
      setTimeout(() => setQueue([]), 4000);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (uploading || pendingUpload) return;
    queueFilesForMonthPick(e.dataTransfer.files);
  }

  const periodLabel = month ? `${hebrewMonthLabel(year, month)} ${year}` : String(year);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/receipts?${archiveQueryString(year, month)}`} className="btn text-sm">
          ← חזרה לתיקיות
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-lg font-bold">
          <span>{props.folderIcon}</span>
          <span>{props.folderName}</span>
          <span className="text-sm font-normal text-zinc-500">· {periodLabel}</span>
        </div>
        <ArchiveFilters
          year={year}
          month={month}
          years={years}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "rounded-2xl border-2 border-dashed p-8 text-center transition",
          dragOver
            ? "border-amber-500 bg-amber-50"
            : "border-zinc-300 bg-zinc-50/80 hover:border-amber-400 hover:bg-amber-50/40",
          uploading ? "pointer-events-none opacity-70" : "cursor-pointer",
        ].join(" ")}
        onClick={() => !uploading && !pendingUpload && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,application/pdf,.pdf"
          onChange={(e) => {
            if (e.target.files?.length) queueFilesForMonthPick(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="text-4xl">📥</div>
        <p className="mt-3 text-base font-semibold text-zinc-800">גרור לכאן תמונות או PDF</p>
        <p className="mt-1 text-sm text-zinc-500">
          לאחר בחירת קבצים תתבקש לציין חודש לכל קבלה · ניתן להעלות כמה במקביל
        </p>
      </div>

      {pendingUpload ? (
        <ReceiptUploadMonthModal
          year={year}
          items={pendingUpload}
          defaultMonth={month}
          uploading={uploading}
          onCancel={() => !uploading && setPendingUpload(null)}
          onConfirm={(items) => void uploadWithMonths(items)}
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {queue.length > 0 ? (
        <div className="card divide-y overflow-hidden">
          {queue.map((item) => (
            <div key={item.fileName} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">{item.fileName}</span>
              <span
                className={
                  item.status === "done"
                    ? "text-emerald-600"
                    : item.status === "error"
                      ? "text-red-600"
                      : "text-amber-600"
                }
              >
                {item.status === "uploading"
                  ? "מעלה..."
                  : item.status === "done"
                    ? "✓ הועלה"
                    : item.message ?? "שגיאה"}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {previewDoc ? (
        <ReceiptPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} onError={setError} />
      ) : null}

      <div className="card overflow-hidden">
        <div className="border-b border-zinc-100 px-4 py-3 text-sm font-medium text-zinc-600">
          {loading && documents.length === 0
            ? "טוען..."
            : `${documents.length} מסמכים בתיקייה`}
        </div>
        {documents.length === 0 && !loading ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-400">אין מסמכים עדיין — גרור קבצים למעלה</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {documents.map((d) => (
              <DocumentRow
                key={d.id}
                doc={d}
                onRenamed={(id, fileName) => {
                  setDocuments((prev) => {
                    const next = prev.map((x) => (x.id === id ? { ...x, fileName } : x));
                    writeFolderDetailCache(props.userId, {
                      folderId: props.folderId,
                      year,
                      month,
                      syncedAt: new Date().toISOString(),
                      folder: { id: props.folderId, name: props.folderName, icon: props.folderIcon },
                      documents: next,
                    });
                    return next;
                  });
                }}
                onDeleted={(id) => {
                  setDocuments((prev) => {
                    const next = prev.filter((x) => x.id !== id);
                    writeFolderDetailCache(props.userId, {
                      folderId: props.folderId,
                      year,
                      month,
                      syncedAt: new Date().toISOString(),
                      folder: { id: props.folderId, name: props.folderName, icon: props.folderIcon },
                      documents: next,
                    });
                    return next;
                  });
                }}
                onError={setError}
                onPreview={setPreviewDoc}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReceiptPreviewModal(props: {
  doc: FolderDocument;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const isImage = props.doc.fileMime.startsWith("image/");
  const isPdf = props.doc.fileMime.includes("pdf");
  const previewSrc = `/api/documents/${props.doc.id}/preview`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);

  async function download() {
    setDownloading(true);
    props.onError(null);
    try {
      const res = await fetch(`/api/documents/${props.doc.id}/download`);
      if (!res.ok) {
        props.onError("לא הצלחנו להוריד את הקובץ");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = props.doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      props.onError("לא הצלחנו להוריד את הקובץ");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="סגור תצוגה מקדימה"
        onClick={props.onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-zinc-900">{props.doc.fileName}</div>
            <div className="text-xs text-zinc-500">תצוגה מקדימה</div>
          </div>
          <button type="button" className="btn text-sm" onClick={() => void download()} disabled={downloading}>
            {downloading ? "מוריד..." : "הורד"}
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-lg text-zinc-600 transition hover:bg-zinc-100"
            onClick={props.onClose}
            aria-label="סגור"
          >
            ✕
          </button>
        </div>
        <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-auto bg-zinc-100 p-4">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={props.doc.fileName}
              className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-md"
            />
          ) : isPdf ? (
            <iframe
              title={props.doc.fileName}
              src={previewSrc}
              className="h-[75vh] w-full rounded-lg border-0 bg-white shadow-md"
            />
          ) : (
            <div className="text-center text-sm text-zinc-500">
              <p>אין תצוגה מקדימה לסוג קובץ זה.</p>
              <button type="button" className="btn btn-primary mt-3" onClick={() => void download()}>
                הורד קובץ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentRow(props: {
  doc: FolderDocument;
  onRenamed: (id: string, fileName: string) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string | null) => void;
  onPreview: (doc: FolderDocument) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(props.doc.fileName);
  const [busy, setBusy] = useState(false);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      props.onError("שם הקבלה לא יכול להיות ריק");
      return;
    }
    if (trimmed === props.doc.fileName) {
      setEditing(false);
      return;
    }
    setBusy(true);
    props.onError(null);
    const res = await fetch(`/api/documents/${props.doc.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: trimmed }),
    });
    setBusy(false);
    if (!res.ok) {
      props.onError("לא הצלחנו לשמור את השם");
      return;
    }
    props.onRenamed(props.doc.id, trimmed);
    setEditing(false);
  }

  async function remove() {
    if (!confirm(`למחוק את "${props.doc.fileName}"?`)) return;
    setBusy(true);
    props.onError(null);
    const res = await fetch(`/api/documents/${props.doc.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      props.onError("לא הצלחנו למחוק את הקבלה");
      return;
    }
    props.onDeleted(props.doc.id);
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-zinc-50">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-right"
        onClick={() => props.onPreview(props.doc)}
        disabled={editing || busy}
      >
        <span className="text-xl">{fileIcon(props.doc.fileMime)}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              className="field py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={busy}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") void saveName();
                if (e.key === "Escape") {
                  setName(props.doc.fileName);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <div className="truncate font-medium text-zinc-900 group-hover:text-amber-800">
              {props.doc.fileName}
            </div>
          )}
          <div className="text-xs text-zinc-500">
            {new Date(props.doc.date).toLocaleDateString("he-IL")} · {formatSize(props.doc.fileSize)}
          </div>
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <>
            <button type="button" className="btn btn-primary text-xs" onClick={() => void saveName()} disabled={busy}>
              שמור
            </button>
            <button
              type="button"
              className="btn text-xs"
              onClick={() => {
                setName(props.doc.fileName);
                setEditing(false);
              }}
              disabled={busy}
            >
              ביטול
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn text-xs"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              ערוך שם
            </button>
            <button type="button" className="btn text-xs" onClick={() => void remove()} disabled={busy}>
              מחק
            </button>
          </>
        )}
      </div>
    </li>
  );
}
