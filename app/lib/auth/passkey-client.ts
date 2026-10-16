"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

const CRED_LS_PREFIX = "nf_passkey_cred:";

type StoredCredential = { id: string; transports?: AuthenticatorTransportFuture[] };

function readStoredCredential(email: string): StoredCredential | null {
  try {
    const raw = localStorage.getItem(`${CRED_LS_PREFIX}${email.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCredential;
    return typeof parsed?.id === "string" && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredCredential(email: string, cred: StoredCredential) {
  try {
    localStorage.setItem(`${CRED_LS_PREFIX}${email.toLowerCase()}`, JSON.stringify(cred));
  } catch {
    // ignore
  }
}

function warmVerifyEndpoint() {
  void fetch("/api/auth/passkey/authentication/verify", { method: "GET", cache: "no-store" }).catch(() => null);
}

/** Options built on the device from a page-issued challenge: no network before Face ID. */
function localOptions(challenge: string, email: string | null | undefined): PublicKeyCredentialRequestOptionsJSON {
  const cred = email ? readStoredCredential(email) : null;
  return {
    challenge,
    rpId: window.location.hostname,
    userVerification: "required",
    timeout: 60_000,
    hints: ["client-device"],
    ...(cred
      ? { allowCredentials: [{ id: cred.id, type: "public-key", transports: cred.transports ?? ["internal", "hybrid"] }] }
      : {}),
  };
}

async function fetchOptions(email: string | null | undefined, mode: "device" | "phone") {
  const optRes = await fetch("/api/auth/passkey/authentication/options", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email ?? null, mode }),
  });
  if (!optRes.ok) {
    const body = (await optRes.json().catch(() => null)) as { error?: string } | null;
    throw new OptionsError(body?.error ?? "לא הצלחתי להתחיל Face ID");
  }
  return (await optRes.json()) as PublicKeyCredentialRequestOptionsJSON;
}

class OptionsError extends Error {}

function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Local Face ID check for an already signed-in session (chat entry gate).
 * No network: the session cookie is the credential; this only proves presence.
 */
export type PresenceCredential = { id: string; transports: string[] };

export async function confirmPresenceWithFaceId(credentials: PresenceCredential[]): Promise<
  { ok: true } | { ok: false; needsGesture?: boolean; error?: string }
> {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials?.get) {
      return { ok: false, error: "המכשיר לא תומך ב־Face ID בדפדפן" };
    }
    // internal only: iOS shows the Face ID prompt. Including "hybrid" shows the
    // "Use Passkey" sheet that requires an extra tap.
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      userVerification: "required",
      timeout: 60_000,
      allowCredentials: credentials.map((c) => ({
        type: "public-key",
        id: fromB64u(c.id),
        transports: ["internal"],
      })),
    };
    const result = await navigator.credentials.get({
      publicKey: Object.assign(publicKey, { hints: ["client-device"] }),
    });
    if (!result) return { ok: false, needsGesture: true };
    return { ok: true };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "NotAllowedError" || name === "AbortError") return { ok: false, needsGesture: true };
    return { ok: false, error: e instanceof Error && e.message ? `שגיאה: ${e.message}` : "Face ID נכשל" };
  }
}

/**
 * One-tap WebAuthn authentication used by login + chat Face ID gate.
 * Pass email when known so only that user's passkeys are offered (faster, clearer).
 * Pass a page-issued `challenge` to skip the options request entirely.
 *
 * mode:
 * - "device" → Touch ID / Face ID / Windows Hello on this computer/phone
 * - "phone"  → cross-device QR (use phone from a desktop browser)
 */
export async function runPasskeyAuthentication(opts?: {
  email?: string | null;
  expectUserId?: string | null;
  mode?: "device" | "phone";
  challenge?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; needsGesture?: boolean }> {
  const mode = opts?.mode ?? "device";
  try {
    warmVerifyEndpoint();

    const optionsJSON =
      opts?.challenge && mode === "device"
        ? localOptions(opts.challenge, opts.email)
        : await fetchOptions(opts?.email, mode);
    const response = await startAuthentication({ optionsJSON });

    const verifyRes = await fetch("/api/auth/passkey/authentication/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        response,
        expectUserId: opts?.expectUserId ?? null,
      }),
    });

    if (!verifyRes.ok) {
      const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? "אימות Face ID נכשל" };
    }

    if (opts?.email) {
      writeStoredCredential(opts.email, { id: response.id });
    }

    return { ok: true };
  } catch (e) {
    if (e instanceof OptionsError) return { ok: false, error: e.message };
    const msg = e instanceof Error ? e.message : "";
    const name = e instanceof Error ? e.name : "";
    const needsGesture =
      name === "NotAllowedError" ||
      msg.includes("NotAllowedError") ||
      msg.includes("not allowed") ||
      msg.includes("timed out");

    if (needsGesture) {
      return {
        ok: false,
        needsGesture: true,
        error:
          mode === "device"
            ? "Face ID לא נפתח. נסה שוב."
            : "לחץ כדי לפתוח התחברות מהטלפון",
      };
    }
    return { ok: false, error: msg ? `שגיאה: ${msg}` : "אימות בוטל או נכשל" };
  }
}
