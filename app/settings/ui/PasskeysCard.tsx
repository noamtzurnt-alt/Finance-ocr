"use client";

import { useEffect, useState } from "react";

function getBiometricLabel() {
  if (typeof navigator === "undefined") return "Face ID / Touch ID";
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "Face ID";
  if (/Macintosh/i.test(ua)) return "Touch ID";
  return "ביומטרי";
}

type PasskeyRow = {
  id: string;
  deviceName: string | null;
  createdAt: string;
};

export default function PasskeysCard() {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<PasskeyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/auth/passkey/list");
    if (!res.ok) return;
    setItems((await res.json()) as PasskeyRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function register() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/registration/options", { method: "POST" });
      if (!optRes.ok) {
        const body = (await optRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "לא הצלחתי להתחיל רישום");
        return;
      }
      const options = (await optRes.json()) as unknown;
      const response = await startRegistration(options as never);
      const verifyRes = await fetch("/api/auth/passkey/registration/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, deviceName: navigator.platform }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "רישום Passkey נכשל");
        return;
      }
      setOk("הופעל! מעכשיו אפשר להתחבר עם Face ID/Touch ID.");
      await load();
    } catch {
      setError("הפעולה בוטלה או נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">
            {(() => {
              const l = getBiometricLabel();
              return l === "ביומטרי" ? "התחברות ביומטרית" : `התחברות עם ${l}`;
            })()}
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            זה עדיין Passkey מאחורי הקלעים — אבל בפועל תראה Face ID/Touch ID בהתאם למכשיר.
          </div>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void register()}>
          {busy
            ? "מפעיל…"
            : (() => {
                const l = getBiometricLabel();
                return l === "ביומטרי" ? "הפעל התחברות ביומטרית" : `הפעל ${l}`;
              })()}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="mt-3 text-sm text-emerald-700">{ok}</p> : null}

      <div className="mt-4">
        {items.length === 0 ? (
          <div className="text-sm text-zinc-600">אין Passkeys עדיין.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200/70">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">מכשיר</th>
                  <th className="px-3 py-2 text-right font-medium">נוצר</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.deviceName ?? "לא ידוע"}</td>
                    <td className="px-3 py-2">{new Date(p.createdAt).toLocaleString("he-IL")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
