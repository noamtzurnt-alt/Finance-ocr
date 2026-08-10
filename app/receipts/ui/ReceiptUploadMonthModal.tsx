"use client";

import { useMemo, useState } from "react";
import { hebrewMonthLabel } from "@/app/lib/receipts/year-date";

export type PendingReceiptUpload = {
  file: File;
  month: number | null;
};

function fileIcon(file: File) {
  if (file.type.startsWith("image/")) return "🖼️";
  if (file.type.includes("pdf")) return "📄";
  return "📎";
}

export default function ReceiptUploadMonthModal(props: {
  year: number;
  items: PendingReceiptUpload[];
  defaultMonth: number | null;
  uploading: boolean;
  onCancel: () => void;
  onConfirm: (items: Array<{ file: File; month: number }>) => void;
}) {
  const [rows, setRows] = useState(() =>
    props.items.map((item) => ({
      file: item.file,
      month: item.month ?? props.defaultMonth,
    })),
  );

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: hebrewMonthLabel(props.year, i + 1) })),
    [props.year],
  );

  const allSelected = rows.every((r) => r.month !== null && r.month >= 1 && r.month <= 12);

  function setMonth(index: number, month: number | null) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, month } : r)));
  }

  function applyMonthToAll(month: number) {
    setRows((prev) => prev.map((r) => ({ ...r, month })));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="סגור"
        onClick={props.onCancel}
        disabled={props.uploading}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-bold text-zinc-900">בחר חודש לכל קבלה</h2>
          <p className="mt-1 text-sm text-zinc-600">
            שנה {props.year} · חובה לציין חודש לכל קובץ לפני ההעלאה
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-zinc-100 bg-amber-50/60 px-5 py-3">
          <span className="text-xs text-zinc-600">החל על הכל:</span>
          {months.map((m) => (
            <button
              key={m.value}
              type="button"
              className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
              onClick={() => applyMonthToAll(m.value)}
              disabled={props.uploading}
            >
              {m.label}
            </button>
          ))}
        </div>

        <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto">
          {rows.map((row, index) => (
            <li key={`${row.file.name}-${index}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="text-xl">{fileIcon(row.file)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900">{row.file.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500" htmlFor={`upload-month-${index}`}>
                  חודש
                </label>
                <select
                  id={`upload-month-${index}`}
                  className={[
                    "field py-1.5 text-sm",
                    row.month == null ? "border-amber-400 ring-1 ring-amber-200" : "",
                  ].join(" ")}
                  value={row.month ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMonth(index, v ? parseInt(v, 10) : null);
                  }}
                  disabled={props.uploading}
                  required
                >
                  <option value="">— בחר חודש —</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
          <button type="button" className="btn" onClick={props.onCancel} disabled={props.uploading}>
            ביטול
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!allSelected || props.uploading}
            onClick={() =>
              props.onConfirm(
                rows.map((r) => ({ file: r.file, month: r.month! })),
              )
            }
          >
            {props.uploading ? "מעלה..." : `העלה ${rows.length} קבצים`}
          </button>
        </div>
      </div>
    </div>
  );
}
