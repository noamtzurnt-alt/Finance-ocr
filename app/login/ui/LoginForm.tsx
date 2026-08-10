"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function getBiometricLabel() {
  if (typeof navigator === "undefined") return "Face ID / Touch ID";
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "Face ID";
  if (/Macintosh/i.test(ua)) return "Touch ID";
  return "ביומטרי";
}

function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/dashboard";
  return raw;
}

const LAST_EMAIL_KEY = "nf_last_email";
const PREFER_PASSKEY_KEY = "nf_prefer_passkey";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const autoStarted = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function loginWithPasskey(opts?: { silent?: boolean; emailOverride?: string }) {
    const silent = opts?.silent === true;
    setError(null);
    setPasskeyBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const emailForAuth = (opts?.emailOverride ?? email).trim();
      const optRes = await fetch("/api/auth/passkey/authentication/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Empty email → discoverable passkeys (one-tap / Face ID).
        body: JSON.stringify({ email: emailForAuth || null }),
      });
      if (!optRes.ok) {
        const body = (await optRes.json().catch(() => null)) as { error?: string } | null;
        if (!silent) setError(body?.error ?? "לא הצלחתי להתחיל התחברות");
        return;
      }
      const optionsJSON = (await optRes.json()) as unknown;
      const response = await startAuthentication({ optionsJSON: optionsJSON as never });
      const verifyRes = await fetch("/api/auth/passkey/authentication/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => null)) as { error?: string; message?: string } | null;
        if (verifyRes.status === 403 && body?.error === "pending_approval") {
          setError(body?.message ?? "ממתין לאישור מנהל המערכת.");
        } else if (!silent) {
          setError(body?.error ?? "התחברות עם Passkey נכשלה");
        }
        return;
      }
      try {
        localStorage.setItem(PREFER_PASSKEY_KEY, "1");
        if (emailForAuth) localStorage.setItem(LAST_EMAIL_KEY, emailForAuth.toLowerCase());
      } catch {
        /* ignore */
      }
      router.replace(nextPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const cancelled =
        /NotAllowedError|timed out|not allowed|AbortError|cancelled|canceled|The operation either timed out or was not allowed/i.test(
          msg,
        );
      // Auto Face ID often gets cancelled/blocked without a tap — stay quiet.
      if (silent && cancelled) return;
      if (msg.includes("timed out") || msg.includes("not allowed") || msg.includes("NotAllowedError")) {
        setError("Passkey: הפעולה נחסמה/פגה. נסה שוב עם הכפתור, או התחבר עם סיסמה.");
      } else if (!silent) {
        setError(msg ? `Passkey: ${msg}` : "התחברות עם Face ID/Touch ID בוטלה או נכשלה");
      }
    } finally {
      setPasskeyBusy(false);
      if (silent) setAutoTried(true);
    }
  }

  // Auto-trigger Face ID as soon as login opens (home screen / widget / redirect).
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    let prefer = true;
    let savedEmail = "";
    try {
      prefer = localStorage.getItem(PREFER_PASSKEY_KEY) !== "0";
      savedEmail = localStorage.getItem(LAST_EMAIL_KEY) ?? "";
    } catch {
      /* ignore */
    }
    if (!prefer) {
      setAutoTried(true);
      return;
    }
    // Tiny delay lets the page paint, then Face ID sheet appears.
    const t = window.setTimeout(() => {
      void loginWithPasskey({ silent: true, emailOverride: savedEmail });
    }, 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (res.status === 403 && body?.error === "pending_approval") {
        setError(body?.message ?? "ממתין לאישור מנהל המערכת. תקבל הודעה כשהחשבון יאושר.");
      } else {
        setError(body?.error ?? body?.message ?? "שגיאת התחברות");
      }
      return;
    }
    try {
      localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
    } catch {
      /* ignore */
    }
    router.replace(nextPath);
  }

  const label = getBiometricLabel();

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <button
        type="button"
        onClick={() => void loginWithPasskey()}
        disabled={passkeyBusy || loading}
        className="w-full rounded-xl border border-zinc-200 bg-white py-2 text-zinc-900 disabled:opacity-60"
      >
        {passkeyBusy
          ? `פותח ${label}…`
          : label === "ביומטרי"
            ? "התחבר עם ביומטרי"
            : autoTried
              ? `נסה שוב עם ${label}`
              : `התחבר עם ${label}`}
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <div className="text-xs text-zinc-500">או עם סיסמה</div>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-950">אימייל</label>
        <input
          dir="auto"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="email"
          name="email"
          autoComplete="username webauthn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-950">סיסמה</label>
        <input
          dir="auto"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-black py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {loading ? "מתחבר..." : "התחבר"}
      </button>
    </form>
  );
}
