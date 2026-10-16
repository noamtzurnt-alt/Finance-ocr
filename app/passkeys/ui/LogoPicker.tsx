"use client";

import { useRef, useState } from "react";

export default function LogoPicker(props: {
  initialLogoUrl: string | null;
  enabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(props.initialLogoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!props.enabled) return null;

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/auth/logo", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "העלאת הלוגו נכשלה");
      return;
    }
    const body = (await res.json().catch(() => null)) as { logoUrl?: string } | null;
    setLogoUrl(body?.logoUrl ?? null);
    setMsg("הלוגו עודכן. רענן את העמוד אם עדיין רואים את הישן.");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function resetLogo() {
    if (!confirm("להחזיר ללוגו ברירת המחדל?")) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/auth/logo", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "איפוס נכשל");
      return;
    }
    setLogoUrl(null);
    setMsg("הוחזר לוגו ברירת המחדל");
  }

  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>לוגו האפליקציה</h3>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          הלוגו יופיע בסרגל הצד. PNG / JPG / WEBP עד 2MB.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div
          className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl || "/noam-finance-bot.webp"}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "מעלה…" : "החלפי לוגו"}
          </button>
          {logoUrl ? (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void resetLogo()}>
              אפסי לברירת מחדל
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      {msg ? <p className="text-sm" style={{ color: "var(--brand)" }}>{msg}</p> : null}
      {error ? <p className="text-sm" style={{ color: "var(--negative)" }}>{error}</p> : null}
    </div>
  );
}
