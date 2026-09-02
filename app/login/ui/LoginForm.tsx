"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function getBiometricLabel() {
  if (typeof navigator === "undefined") return "Face ID / Touch ID";
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "Face ID";
  if (/Macintosh/i.test(ua)) return "Touch ID";
  return "ביומטרי";
}

function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/chat";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/chat";
  return raw;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loginWithPasskey() {
    setError(null);
    setBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/authentication/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: null }),
      });
      if (!optRes.ok) {
        const body = (await optRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "לא הצלחתי להתחיל התחברות");
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
        const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "התחברות נכשלה");
        return;
      }
      router.replace(nextPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("timed out") || msg.includes("not allowed") || msg.includes("NotAllowedError")) {
        setError("הפעולה בוטלה או נחסמה, נסה שוב.");
      } else {
        setError(msg ? `שגיאה: ${msg}` : "ההתחברות בוטלה או נכשלה");
      }
    } finally {
      setBusy(false);
    }
  }

  const label = getBiometricLabel();

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void loginWithPasskey()}
        disabled={busy}
        className="btn btn-primary w-full py-3 disabled:opacity-60"
      >
        {busy ? `פותח ${label}…` : label === "ביומטרי" ? "התחבר עם ביומטרי" : `התחבר עם ${label}`}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
