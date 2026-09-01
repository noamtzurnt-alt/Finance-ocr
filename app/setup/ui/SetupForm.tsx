"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "passkey">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאת הגדרה");
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
      router.replace("/chat");
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
        <p className="text-sm text-zinc-600">
          עכשיו נרשום את המכשיר הזה כ־Passkey (Face ID / Touch ID), זו תהיה הדרך היחידה להתחבר.
        </p>
        <button
          disabled={loading}
          onClick={() => void onRegisterPasskey()}
          className="w-full rounded-xl bg-black py-2 text-white disabled:opacity-60"
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
        <label className="text-sm font-medium text-zinc-950">אימייל</label>
        <input
          dir="auto"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-black py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {loading ? "יוצר..." : "המשך"}
      </button>
    </form>
  );
}
