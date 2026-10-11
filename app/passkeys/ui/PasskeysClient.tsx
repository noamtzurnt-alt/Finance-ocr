"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PasskeyRow = { id: string; deviceName: string | null; createdAt: string };

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function detectDeviceName() {
  if (typeof navigator === "undefined") return "מכשיר חדש";
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  return "מכשיר חדש";
}

function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return null;
  return raw;
}

export default function PasskeysClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addDevice = searchParams.get("addDevice") === "1";
  const nextPath = safeNextPath(searchParams.get("next"));

  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(
    addDevice ? "התחברת מהטלפון — עכשיו נוסיף את המחשב הזה (Touch ID / Windows Hello)." : null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const autoAddStarted = useRef(false);

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
      const deviceName = detectDeviceName();
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
      setMsg(
        deviceName === "Mac"
          ? "ה־Mac נוסף — בפעם הבאה אפשר להתחבר עם Touch ID"
          : deviceName === "Windows"
            ? "המחשב נוסף — בפעם הבאה אפשר להתחבר עם Windows Hello"
            : "המכשיר נוסף בהצלחה",
      );
      load();
      if (nextPath) {
        window.setTimeout(() => router.replace(nextPath), 900);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(message ? `שגיאה: ${message}` : "הרישום בוטל או נכשל");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!addDevice || autoAddStarted.current) return;
    autoAddStarted.current = true;
  }, [addDevice]);

  function startRename(row: PasskeyRow) {
    setEditingId(row.id);
    setEditName(row.deviceName ?? "");
    setError(null);
    setMsg(null);
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) {
      setError("צריך שם למכשיר");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/passkey/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceName: name }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "עדכון השם נכשל");
      return;
    }
    setEditingId(null);
    setMsg("שם המכשיר עודכן");
    load();
  }

  async function removePasskey(row: PasskeyRow) {
    const label = row.deviceName ?? "מכשיר ללא שם";
    if (!confirm(`למחוק את ה־Passkey של “${label}”?`)) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/auth/passkey/${row.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "מחיקה נכשלה");
      return;
    }
    setMsg("המכשיר נמחק");
    if (editingId === row.id) setEditingId(null);
    load();
  }

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Passkeys / ביומטרי
          </h3>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            כל מכשיר צריך Passkey משלו: Mac עם Touch ID, Windows עם Windows Hello, וטלפון עם Face
            ID. הוסף את המחשב הנוכחי כדי לא לסרוק QR בכל פעם.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void addPasskey()}>
          {busy ? "עובד…" : addDevice ? "+ הוסף מחשב זה" : "+ הוסף מכשיר"}
        </button>
      </div>

      {msg ? <p className="text-sm" style={{ color: "var(--brand)" }}>{msg}</p> : null}
      {error ? <p className="text-sm" style={{ color: "var(--negative)" }}>{error}</p> : null}

      {rows === null ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>טוען רשימה…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-6 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>אין עדיין Passkeys</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            הוסף את המכשיר הנוכחי כדי להתחבר עם ביומטרי
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, index) => {
            const isEditing = editingId === r.id;
            return (
              <li
                key={r.id}
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                      מכשיר {index + 1}
                    </p>
                    {isEditing ? (
                      <input
                        className="field field-compact mt-1 max-w-xs"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="למשל: MacBook"
                        disabled={busy}
                        autoFocus
                      />
                    ) : (
                      <p className="mt-0.5 truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {r.deviceName ?? "מכשיר ללא שם"}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                      נוסף {formatWhen(r.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveRename(r.id)}>
                          שמור
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditingId(null)}>
                          ביטול
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => startRename(r)}>
                          שנה שם
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void removePasskey(r)}>
                          מחק
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
