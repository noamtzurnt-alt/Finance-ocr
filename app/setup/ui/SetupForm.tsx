"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { defaultThemeForEmail, isAllowedAccountEmail, normalizeEmail } from "@/app/lib/auth/accounts";

export default function SetupForm(props: { inviteRequired?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [step, setStep] = useState<"email" | "passkey">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onEmailChange(value: string) {
    setEmail(value);
    const normalized = normalizeEmail(value);
    if (isAllowedAccountEmail(normalized)) {
      document.documentElement.dataset.theme = defaultThemeForEmail(normalized);
    }
  }

  async function onCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalized = normalizeEmail(email);
    if (!isAllowedAccountEmail(normalized)) {
      setLoading(false);
      setError("אפשר להירשם רק עם האימייל של Noam או Meitar.");
      return;
    }

    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: normalized,
        ...(props.inviteRequired ? { inviteCode } : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאת הרשמה");
      return;
    }
    setStep("passkey");
  }

  async function onRegisterPasskey() {
    setLoading(true);
    setError(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/registration/options", { method: "POST" });
      if (!optRes.ok) {
        const body = (await optRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "לא הצלחתי להתחיל רישום Passkey");
        return;
      }
      const optionsJSON = (await optRes.json()) as unknown;
      const response = await startRegistration({ optionsJSON: optionsJSON as never });
      const verifyRes = await fetch("/api/auth/passkey/registration/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "רישום Passkey נכשל");
        return;
      }
      router.replace("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? `שגיאה: ${msg}` : "רישום Passkey בוטל או נכשל");
    } finally {
      setLoading(false);
    }
  }

  if (step === "passkey") {
    return (
      <div className="space-y-3">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          עכשיו נרשום את המכשיר הזה כ־Passkey (Face ID / Touch ID). זו תהיה הדרך להתחבר לחשבון שלך בלבד.
        </p>
        <button
          disabled={loading}
          onClick={() => void onRegisterPasskey()}
          className="btn btn-primary w-full py-2"
          type="button"
        >
          {loading ? "נרשם..." : "הוסף Face ID / Passkey"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={onCreateAccount} className="space-y-3">
      <div>
        <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>אימייל</label>
        <input
          dir="auto"
          className="field mt-1"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="noamtzurt@gmail.com או meitar672@gmail.com"
          required
          autoComplete="email"
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
          הרשמה רק ל־Noam או Meitar. הצבעים נקבעים אוטומטית לפי האימייל.
        </p>
      </div>

      {props.inviteRequired ? (
        <div>
          <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>קוד הזמנה</label>
          <input
            dir="auto"
            className="field mt-1"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="הקוד שקיבלת"
            required
            autoComplete="off"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        disabled={loading}
        className="btn btn-primary w-full py-2"
        type="submit"
      >
        {loading ? "יוצר..." : "צור חשבון"}
      </button>
    </form>
  );
}
