"use client";

import { useMemo, useState } from "react";

export default function ExportClient(props: { defaultYear: number }) {
  const clampYear = (y: number) => Math.min(2030, Math.max(2024, y));
  const [year, setYear] = useState(String(clampYear(props.defaultYear)));
  const [downloading, setDownloading] = useState<null | "xlsx" | "zip">(null);

  const yearNum = useMemo(() => Number(year), [year]);
  const quickYears = useMemo(() => {
    return Array.from({ length: 2030 - 2024 + 1 }, (_, i) => 2024 + i);
  }, []);

  function download(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function exportXlsx() {
    setDownloading("xlsx");
    download(`/api/export/${yearNum}/xlsx`);
    window.setTimeout(() => setDownloading(null), 1200);
  }

  async function exportZip() {
    setDownloading("zip");
    download(`/api/export/${yearNum}/zip`);
    window.setTimeout(() => setDownloading(null), 1200);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">שנה</label>
        <input
          className="field mt-1"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          inputMode="numeric"
          type="number"
          min={2024}
          max={2030}
          placeholder="2026"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {quickYears.map((y) => {
            const isActive = String(y) === year;
            return (
              <button
                key={y}
                type="button"
                className={isActive ? "btn btn-primary" : "btn"}
                onClick={() => setYear(String(y))}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950">
        <p className="font-semibold">מה יוצא לרו״ח לשנה שנבחרה</p>
        <ul className="mt-2 list-disc space-y-1 pr-5 text-indigo-800">
          <li>
            <strong>מסמך 1 — הוצאות מוכרות:</strong> כל ההוצאות של השנה
          </li>
          <li>
            <strong>מסמך 2 — קבלות הכנסות:</strong> כל הקבלות של השנה
          </li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportXlsx}
          disabled={downloading != null || !Number.isFinite(yearNum)}
          className="btn btn-primary disabled:opacity-60"
        >
          {downloading === "xlsx" ? "מכין…" : "הורד XLSX (2 גיליונות)"}
        </button>
        <button
          type="button"
          onClick={exportZip}
          disabled={downloading != null || !Number.isFinite(yearNum)}
          className="btn disabled:opacity-60"
        >
          {downloading === "zip" ? "מכין…" : "הורד ZIP (2 קבצי Excel + קבצים)"}
        </button>
      </div>

      <p className="text-sm text-zinc-600">
        ה־XLSX כולל שני גיליונות: הוצאות מוכרות וקבלות הכנסות. ה־ZIP כולל שני קבצי Excel נפרדים
        (אחד להוצאות ואחד לקבלות) ואת כל קבצי ה־PDF/תמונה המקוריים, מסודרים לפי חודש.
      </p>
    </div>
  );
}
