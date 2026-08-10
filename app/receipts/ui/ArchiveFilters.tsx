"use client";

import { useMemo } from "react";
import { hebrewMonthLabel } from "@/app/lib/receipts/year-date";

export default function ArchiveFilters(props: {
  year: number;
  month: number | null;
  years: number[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
}) {
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: hebrewMonthLabel(props.year, i + 1) })),
    [props.year],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500" htmlFor="archive-year">
          שנה
        </label>
        <select
          id="archive-year"
          className="field py-1.5 text-sm"
          value={props.year}
          onChange={(e) => props.onYearChange(parseInt(e.target.value, 10))}
        >
          {props.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500" htmlFor="archive-month">
          חודש
        </label>
        <select
          id="archive-month"
          className="field py-1.5 text-sm"
          value={props.month ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            props.onMonthChange(v ? parseInt(v, 10) : null);
          }}
        >
          <option value="">כל השנה</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
