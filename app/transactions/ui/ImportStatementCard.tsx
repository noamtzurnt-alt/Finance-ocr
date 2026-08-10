"use client";

import { useMemo, useRef, useState } from "react";

type BudgetScope = "personal" | "business";
type Category = { id: string; name: string; budgetScope: BudgetScope };

type CalPreviewRow = {
  key: string;
  source: "cal";
  date: string;
  amount: string;
  vendor: string;
  description: string | null;
  matchExisting: boolean;
  categoryId: string;
  categoryName: string | null;
  categoryScope: BudgetScope | null;
  confidence: "high" | "medium" | "unclassified";
  classificationReason: string;
  discarded: boolean;
};

type ExistingPreviewRow = {
  key: string;
  source: "manual";
  id: string;
  date: string;
  amount: string;
  vendor: string;
  description: string | null;
  categoryName: string | null;
  discarded: boolean;
};

type PreviewRow = CalPreviewRow | ExistingPreviewRow;

export default function ImportStatementCard(props: {
  categories: Category[];
  defaultCardLast4?: string;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [cardLast4, setCardLast4] = useState(props.defaultCardLast4 ?? "");

  const categoriesByScope = useMemo(
    () => ({
      personal: props.categories.filter((c) => c.budgetScope === "personal"),
      business: props.categories.filter((c) => c.budgetScope === "business"),
    }),
    [props.categories],
  );

  const keptCal = rows.filter((r) => r.source === "cal" && !r.discarded).length;
  const keptManual = rows.filter((r) => r.source === "manual" && !r.discarded).length;
  const trashCal = rows.filter((r) => r.source === "cal" && r.discarded).length;
  const trashManual = rows.filter((r) => r.source === "manual" && r.discarded).length;
  const inPreview = rows.length > 0;

  function openModal() {
    setOpen(true);
    setError(null);
    setRows([]);
    setFileName(null);
    setRange(null);
  }

  function resetPreview() {
    setRows([]);
    setFileName(null);
    setRange(null);
    setError(null);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
    resetPreview();
  }

  function finishAndClose() {
    setOpen(false);
    resetPreview();
    setBusy(false);
  }

  function toggleTrash(key: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, discarded: !r.discarded } : r)));
  }

  function setRowCategory(key: string, categoryId: string) {
    const category = props.categories.find((item) => item.id === categoryId) ?? null;
    setRows((prev) =>
      prev.map((row) =>
        row.key === key && row.source === "cal"
          ? {
              ...row,
              categoryId,
              categoryName: category?.name ?? null,
              categoryScope: category?.budgetScope ?? null,
              confidence: category ? "high" : "unclassified",
              classificationReason: category ? "נבחר ידנית" : "לא סווג",
            }
          : row,
      ),
    );
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setFileName(file.name);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/transactions/import", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as
        | {
            error?: string;
            fileName?: string;
            range?: { from: string; to: string } | null;
            calRows?: Array<{
              date: string;
              amount: string;
              vendor: string;
              description: string | null;
              matchExisting?: boolean;
              categoryId?: string | null;
              categoryName?: string | null;
              categoryScope?: BudgetScope | null;
              confidence?: "high" | "medium" | "unclassified";
              reason?: string;
            }>;
            existingRows?: Array<{
              id: string;
              date: string;
              amount: string;
              vendor: string;
              description: string | null;
              categoryName: string | null;
            }>;
          }
        | null;

      if (!res.ok) {
        setError(body?.error ?? "שגיאה בפענוח הקובץ");
        setRows([]);
        return;
      }

      setRange(body?.range ?? null);

      const cal: CalPreviewRow[] = (body?.calRows ?? []).map((r, i) => ({
        key: `cal-${r.date}-${r.vendor}-${r.amount}-${i}`,
        source: "cal" as const,
        date: r.date,
        amount: r.amount,
        vendor: r.vendor,
        description: r.description,
        matchExisting: Boolean(r.matchExisting),
        categoryId: r.categoryId ?? "",
        categoryName: r.categoryName ?? null,
        categoryScope: r.categoryScope ?? null,
        confidence: r.confidence ?? "unclassified",
        classificationReason: r.reason ?? "לא סווג",
        // If already exists manually — discard CAL copy by default (don't overwrite)
        discarded: Boolean(r.matchExisting),
      }));

      const manual: ExistingPreviewRow[] = (body?.existingRows ?? []).map((r) => ({
        key: `manual-${r.id}`,
        source: "manual" as const,
        id: r.id,
        date: r.date,
        amount: r.amount,
        vendor: r.vendor,
        description: r.description,
        categoryName: r.categoryName,
        discarded: false,
      }));

      const merged = [...cal, ...manual].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.vendor.localeCompare(b.vendor, "he");
      });
      setRows(merged);
    } catch {
      setError("שגיאה בהעלאת הקובץ");
      setRows([]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveFinal() {
    const toCreate = rows.filter((r): r is CalPreviewRow => r.source === "cal" && !r.discarded);
    const toDelete = rows.filter((r): r is ExistingPreviewRow => r.source === "manual" && r.discarded);

    if (toCreate.length === 0 && toDelete.length === 0) {
      setError("לא נבחרו שינוים — מחק תנועות או השאר תנועות מכאל");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: toCreate.map((r) => ({
            date: r.date,
            amount: r.amount,
            vendor: r.vendor,
            description: r.description,
            categoryId: r.categoryId || null,
          })),
          deleteIds: toDelete.map((r) => r.id),
          cardLast4: cardLast4 || null,
          isFixed: false,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "שמירה נכשלה");
        setBusy(false);
        return;
      }
      props.onImported();
      finishAndClose();
    } catch {
      setError("שמירה נכשלה");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={openModal}>
        📥 ייבוא מקובץ כאל
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="סגור"
            onClick={closeModal}
          />
          <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="border-b border-zinc-200 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">
                    {inPreview ? "תצוגה מקדימה — מיזוג תנועות" : "ייבוא תנועות מכאל"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {inPreview
                      ? "עבור על הרשימה: 🗑 מסמן תנועה לוויתור. תנועות ידניות נשמרות אלא אם תמחק אותן. בסיום לחץ שמור."
                      : "העלה קובץ Excel/CSV מכאל. אחר כך תראה תצוגה מקדימה מול התנועות הקיימות."}
                  </p>
                </div>
                <button type="button" className="btn text-sm" onClick={closeModal} disabled={busy}>
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {!inPreview ? (
                <div
                  className="cursor-pointer rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={() => !busy && inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (busy) return;
                    const f = e.dataTransfer.files?.[0];
                    if (f) void onFile(f);
                  }}
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
                    accept=".xlsx,.xlsm,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="text-3xl">💳</div>
                  <p className="mt-2 font-semibold text-zinc-800">
                    {busy ? "קורא קובץ..." : "גרור קובץ לכאן או לחץ לבחירה"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Excel (.xlsx) או CSV · לא PDF</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm">
                    <div>
                      <span className="font-semibold text-blue-900">{fileName}</span>
                      {range ? (
                        <span className="mr-2 text-blue-700">
                          · {range.from} עד {range.to}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn text-xs"
                      disabled={busy}
                      onClick={() => {
                        setRows([]);
                        setFileName(null);
                        setRange(null);
                        setError(null);
                      }}
                    >
                      החלף קובץ
                    </button>
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="max-w-xl">
                      <p className="text-sm font-semibold text-indigo-950">סיווג חכם לכל תנועה בנפרד</p>
                      <p className="mt-1 text-xs leading-relaxed text-indigo-700">
                        המערכת לומדת מהסיווגים הקודמים שלך ומזהה בתי עסק מוכרים. כשאין ודאות,
                        התנועה נשמרת כ״לא סווג״ במקום לקבל קטגוריה שגויה.
                      </p>
                    </div>
                    <div className="w-36">
                      <label className="text-xs font-medium text-zinc-600">4 ספרות כרטיס</label>
                      <input
                        className="field mt-1"
                        value={cardLast4}
                        onChange={(e) => setCardLast4(e.target.value)}
                        placeholder="7374"
                        maxLength={8}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-800">
                      כאל ייכנסו: {keptCal}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
                      ידני יישארו: {keptManual}
                    </span>
                    {trashCal > 0 ? (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">
                        כאל בוטלו: {trashCal}
                      </span>
                    ) : null}
                    {trashManual > 0 ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
                        ידני יימחקו: {trashManual}
                      </span>
                    ) : null}
                  </div>

                  <div className="max-h-[48vh] overflow-auto rounded-xl border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-zinc-100 text-zinc-600">
                        <tr>
                          <th className="px-3 py-2 text-right font-medium">מקור</th>
                          <th className="px-3 py-2 text-right font-medium">תאריך</th>
                          <th className="px-3 py-2 text-right font-medium">בית עסק</th>
                          <th className="px-3 py-2 text-right font-medium">סיווג</th>
                          <th className="px-3 py-2 text-right font-medium">סכום</th>
                          <th className="px-3 py-2 text-right font-medium">אשפה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const isCal = r.source === "cal";
                          return (
                            <tr
                              key={r.key}
                              className={[
                                "border-t transition",
                                r.discarded ? "bg-red-50/60 text-zinc-400 line-through" : "hover:bg-zinc-50",
                                isCal && !r.discarded && r.matchExisting ? "bg-amber-50/50" : "",
                              ].join(" ")}
                            >
                              <td className="px-3 py-2">
                                <span
                                  className={[
                                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    isCal
                                      ? "bg-sky-100 text-sky-800"
                                      : "bg-emerald-100 text-emerald-800",
                                  ].join(" ")}
                                >
                                  {isCal ? "כאל" : "ידני"}
                                </span>
                                {isCal && r.matchExisting && !r.discarded ? (
                                  <div className="mt-1 text-[10px] text-amber-700">דומה לידני</div>
                                ) : null}
                                {!isCal && r.categoryName ? (
                                  <div className="mt-1 text-[10px] text-zinc-500">{r.categoryName}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                              <td className="px-3 py-2">
                                <div className="max-w-[16rem] truncate font-medium">{r.vendor}</div>
                                {r.description ? (
                                  <div className="max-w-[16rem] truncate text-[11px] text-zinc-500">
                                    {r.description}
                                  </div>
                                ) : null}
                              </td>
                              <td className="min-w-48 px-3 py-2">
                                {isCal ? (
                                  <div>
                                    <select
                                      className={[
                                        "field py-1.5 text-xs",
                                        r.categoryId ? "" : "border-amber-300 bg-amber-50",
                                      ].join(" ")}
                                      value={r.categoryId}
                                      onChange={(event) => setRowCategory(r.key, event.target.value)}
                                      disabled={busy || r.discarded}
                                    >
                                      <option value="">לא סווג</option>
                                      <optgroup label="🏠 אישי">
                                        {categoriesByScope.personal.map((category) => (
                                          <option key={category.id} value={category.id}>{category.name}</option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="🏢 עסקי">
                                        {categoriesByScope.business.map((category) => (
                                          <option key={category.id} value={category.id}>{category.name}</option>
                                        ))}
                                      </optgroup>
                                    </select>
                                    <div
                                      className={[
                                        "mt-1 text-[10px]",
                                        r.confidence === "high"
                                          ? "text-emerald-700"
                                          : r.confidence === "medium"
                                            ? "text-indigo-600"
                                            : "text-amber-700",
                                      ].join(" ")}
                                    >
                                      {r.classificationReason}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-zinc-500">{r.categoryName ?? "לא סווג"}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap font-semibold">{r.amount} ₪</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className={[
                                    "flex h-8 w-8 items-center justify-center rounded-lg transition",
                                    r.discarded
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                      : "text-zinc-400 hover:bg-red-50 hover:text-red-600",
                                  ].join(" ")}
                                  title={r.discarded ? "החזר תנועה" : "וותר על תנועה"}
                                  onClick={() => toggleTrash(r.key)}
                                  disabled={busy}
                                >
                                  {r.discarded ? (
                                    <span className="text-sm" aria-hidden>
                                      ↩
                                    </span>
                                  ) : (
                                    <svg
                                      viewBox="0 0 16 16"
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      aria-hidden
                                    >
                                      <path
                                        d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button type="button" className="btn" onClick={closeModal} disabled={busy}>
                ביטול
              </button>
              {inPreview ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void saveFinal()}
                >
                  {busy
                    ? "שומר..."
                    : `שמור · +${keptCal} מכאל${trashManual > 0 ? ` · −${trashManual} ידני` : ""}`}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
