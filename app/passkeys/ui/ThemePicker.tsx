"use client";

import { useEffect, useState } from "react";
import type { AppTheme } from "@/app/lib/ui/theme";
import { normalizeAppTheme } from "@/app/lib/ui/theme";

export default function ThemePicker(props: { initialTheme: AppTheme }) {
  const [theme, setTheme] = useState<AppTheme>(props.initialTheme);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTheme(props.initialTheme);
  }, [props.initialTheme]);

  async function save(next: AppTheme) {
    setBusy(true);
    setError(null);
    setMsg(null);
    setTheme(next);
    document.documentElement.dataset.theme = next;

    const res = await fetch("/api/auth/theme", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שמירת ערכת הצבעים נכשלה");
      setTheme(props.initialTheme);
      document.documentElement.dataset.theme = props.initialTheme;
      return;
    }

    const body = (await res.json().catch(() => null)) as { theme?: string } | null;
    const saved = normalizeAppTheme(body?.theme ?? next);
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
    setMsg(saved === "pink" ? "עברת לערכת ורוד" : "עברת לערכת ירוק");
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>ערכת צבעים</h3>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          לכל חשבון יש מראה משלו. מיתר — ורוד. Noam — ירוק.
        </p>
      </div>

      <div className="theme-picker">
        <button
          type="button"
          disabled={busy}
          className={`theme-picker-option${theme === "pink" ? " is-active" : ""}`}
          data-theme-swatch="pink"
          onClick={() => void save("pink")}
        >
          <span className="theme-picker-dot" />
          ורוד · מיתר
        </button>
        <button
          type="button"
          disabled={busy}
          className={`theme-picker-option${theme === "green" ? " is-active" : ""}`}
          data-theme-swatch="green"
          onClick={() => void save("green")}
        >
          <span className="theme-picker-dot" />
          ירוק · Noam
        </button>
      </div>

      {msg ? <p className="text-sm" style={{ color: "var(--brand)" }}>{msg}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
