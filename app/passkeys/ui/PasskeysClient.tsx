"use client";

import { useEffect, useState } from "react";

type PasskeyRow = { id: string; deviceName: string | null; createdAt: string };

export default function PasskeysClient() {
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    fetch("/api/auth/passkey/list")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PasskeyRow[]) => setRows(d))
      .catch(() => setError("שגיאה בטעינת רשימת ה-Passkeys"));
  }

  useEffect(() => {
    load();
  }, []);

  async function addPasskey() {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/registration/options", { method: "POST" });
      if (!optRes.ok) {
        const body = (await optRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "לא הצלחתי להתחיל רישום");
        return;
      }
      const optionsJSON = (await optRes.json()) as unknown;
      const response = await startRegistration({ optionsJSON: optionsJSON as never });
      const deviceName =
        typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
          ? "iPhone"
          : typeof navigator !== "undefined" && /Macintosh/i.test(navigator.userAgent)
            ? "Mac"
            : null;
      const verifyRes = await fetch("/api/auth/passkey/registration/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, deviceName }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "רישום נכשל");
        return;
      }
      setMsg("המכשיר נוסף בהצלחה");
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? `שגיאה: ${msg}` : "הרישום בוטל או נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void addPasskey()}>
          {busy ? "נרשם..." : "+ הוסף מכשיר (Passkey)"}
        </button>
        {msg ? <p className="mt-2 text-sm text-emerald-700">{msg}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="card p-4">
        {rows === null ? (
          <p className="text-sm text-zinc-400">טוען...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-400">אין עדיין Passkeys רשומים.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--foreground)]">{r.deviceName ?? "מכשיר ללא שם"}</span>
                <span className="text-xs text-zinc-400">{new Date(r.createdAt).toLocaleDateString("he-IL")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
