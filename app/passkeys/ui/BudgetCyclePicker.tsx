"use client";

import { useState } from "react";

const MAX_DAY = 28;
const DAYS = Array.from({ length: MAX_DAY }, (_, i) => i + 1);

export default function BudgetCyclePicker(props: { initialStartDay: number; initialLabel: string }) {
  const [startDay, setStartDay] = useState(props.initialStartDay);
  const [label, setLabel] = useState(props.initialLabel);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(next: number) {
    const prev = startDay;
    setBusy(true);
    setError(null);
    setMsg(null);
    setStartDay(next);

    const res = await fetch("/api/auth/budget-cycle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ startDay: next }),
    });
    setBusy(false);

    const body = (await res.json().catch(() => null)) as { error?: string; label?: string } | null;
    if (!res.ok) {
      setError(body?.error ?? "שמירת יום תחילת החודש נכשלה");
      setStartDay(prev);
      return;
    }
    if (body?.label) setLabel(body.label);
    setMsg("נשמר. הדשבורד, התקציב והצ׳אט יחושבו לפי החודש החדש.");
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>חודש תקציבי</h3>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          באיזה יום מתחיל החודש שלך? כדאי לבחור את יום כניסת המשכורת. 1 = חודש קלנדרי רגיל.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm" style={{ color: "var(--foreground)" }}>
        <span>החודש מתחיל ב־</span>
        <select
          className="field w-24"
          value={startDay}
          disabled={busy}
          onChange={(e) => void save(Number(e.target.value))}
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span>לחודש</span>
      </label>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        החודש הנוכחי: {label}
      </p>

      {msg ? <p className="text-sm" style={{ color: "var(--brand)" }}>{msg}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
