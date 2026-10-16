"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { runPasskeyAuthentication } from "@/app/lib/auth/passkey-client";

type LoginAccount = {
  email: string;
  name: string;
  chatLabel: string;
};

type AuthMode = "device" | "phone";

function getDeviceLabel() {
  if (typeof navigator === "undefined") return "Face ID / Touch ID";
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "Face ID";
  if (/Macintosh/i.test(ua)) return "Touch ID";
  if (/Windows/i.test(ua)) return "Windows Hello";
  if (/Android/i.test(ua)) return "טביעת אצבע";
  return "ביומטרי";
}

function isDesktopBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return /Macintosh|Windows|Linux/i.test(ua) && !/iPhone|iPad|iPod|Android/i.test(ua);
}

function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/chat";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/chat";
  return raw;
}

export default function LoginForm(props: { accounts: LoginAccount[]; challenge?: string | null }) {
  const challengeRef = useRef(props.challenge ?? null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [selectedEmail, setSelectedEmail] = useState(props.accounts[0]?.email ?? "");

  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<AuthMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(true);
  const started = useRef(false);
  const desktop = isDesktopBrowser();
  const deviceLabel = getDeviceLabel();

  async function loginWithPasskey(mode: AuthMode, email?: string, fromTap = false) {
    const chosenEmail = (email ?? selectedEmail).trim();
    if (!chosenEmail) {
      setError("בחר חשבון להתחברות.");
      setNeedsTap(true);
      setBusy(false);
      setBusyMode(null);
      return;
    }
    setError(null);
    setBusy(true);
    setBusyMode(mode);
    const challenge = challengeRef.current;
    challengeRef.current = null;
    const result = await runPasskeyAuthentication({ email: chosenEmail, mode, challenge });
    setBusy(false);
    setBusyMode(null);

    if (result.ok) {
      const dest =
        mode === "phone" && desktop
          ? `/passkeys?addDevice=1&next=${encodeURIComponent(nextPath)}`
          : nextPath;
      router.replace(dest);
      return;
    }

    setNeedsTap(true);
    if (fromTap || !result.needsGesture) setError(result.error ?? "Face ID לא נפתח");
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // On phone (including the iOS app shell), auto-start Face ID. On desktop wait for tap to avoid "No passkeys" popup spam.
    if (!desktop && props.accounts.length === 1 && props.accounts[0]?.email) {
      setBusy(true);
      setBusyMode("device");
      void loginWithPasskey("device", props.accounts[0].email);
      return;
    }
    setNeedsTap(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.accounts]);

  return (
    <div className="space-y-3">
      {props.accounts.length > 1 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            לאיזה חשבון להתחבר?
          </p>
          <div className="grid gap-2">
            {props.accounts.map((account) => {
              const active = selectedEmail === account.email;
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setSelectedEmail(account.email)}
                  className="rounded-2xl border px-4 py-3 text-right transition"
                  style={{
                    borderColor: active ? "var(--brand)" : "var(--border)",
                    background: active ? "var(--brand-soft)" : "var(--surface)",
                    color: "var(--foreground)",
                  }}
                >
                  <div className="text-sm font-semibold">{account.chatLabel}</div>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    {account.name} · {account.email}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void loginWithPasskey("device", undefined, true)}
        disabled={busy}
        className="btn btn-primary w-full py-3 disabled:opacity-60"
      >
        {busy && busyMode === "device"
          ? `ממתין ל־${deviceLabel}…`
          : needsTap
            ? `המשך עם ${deviceLabel}`
            : `התחבר עם ${deviceLabel}`}
      </button>

      {desktop ? (
        <button
          type="button"
          onClick={() => void loginWithPasskey("phone", undefined, true)}
          disabled={busy}
          className="btn btn-ghost w-full py-2.5 disabled:opacity-60"
        >
          {busy && busyMode === "phone" ? "ממתין לטלפון…" : "התחבר עם הטלפון (סריקת QR)"}
        </button>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
