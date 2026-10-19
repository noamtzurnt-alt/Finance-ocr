"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { confirmPresenceWithFaceId, type PresenceCredential } from "@/app/lib/auth/passkey-client";

const UNLOCK_KEY = "nf-face-open";
const APP_KEY = "nf-face-app";
const CREDS_KEY = "nf-face-creds";
const HIDDEN_KEY = "nf-face-hidden-at";
const CHANNEL = "nf-face";

function isIosHomeApp() {
  const ua = navigator.userAgent ?? "";
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && standalone;
}

function isMac() {
  const ua = navigator.userAgent ?? "";
  return /Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
}

/** Another open tab of this site already passed Touch ID. */
function askOpenTab(): Promise<boolean> {
  return new Promise((resolve) => {
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(CHANNEL);
    } catch {
      resolve(false);
      return;
    }
    const timer = window.setTimeout(() => {
      channel.close();
      resolve(false);
    }, 250);
    channel.onmessage = (event) => {
      if (event.data !== "yes") return;
      window.clearTimeout(timer);
      channel.close();
      resolve(true);
    };
    channel.postMessage("ask");
  });
}

function readCreds(): PresenceCredential[] {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PresenceCredential[];
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c?.id === "string") : [];
  } catch {
    return [];
  }
}

function writeCreds(creds: PresenceCredential[]) {
  try {
    localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  } catch {}
}

function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
    if (isIosHomeApp()) localStorage.setItem(UNLOCK_KEY, "1");
  } catch {}
}

function markIosHidden() {
  try {
    localStorage.setItem(HIDDEN_KEY, String(Date.now()));
  } catch {}
}

function iosResumeWithoutFaceId() {
  if (!isIosHomeApp()) return false;
  try {
    if (sessionStorage.getItem(UNLOCK_KEY) === "1") return true;
    if (localStorage.getItem(UNLOCK_KEY) !== "1") return false;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload" || nav?.type === "back_forward") return true;
    const hiddenAt = Number(localStorage.getItem(HIDDEN_KEY) || 0);
    // iOS sometimes relaunches a backgrounded PWA as a new navigation.
    // A real swipe-away from the switcher is a home-screen launch without
    // that recent hide, or after the process has been gone long enough.
    return hiddenAt > 0 && Date.now() - hiddenAt < 10 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Biometric only when a session starts.
 * On iPhone: after the home-screen app was swiped away.
 * On Mac: the first time פתקים or Noam Finance is opened.
 * Moving between pages keeps the tab, so it does not ask again.
 * Closing the page clears sessionStorage, so the next open asks again.
 * A second window asks only if no page of the site is still open.
 */
export default function ChatFaceIdGate(props: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Noam Finance");
  const [biometric, setBiometric] = useState("Face ID");
  const credsRef = useRef<PresenceCredential[]>([]);

  useEffect(() => {
    if (locked) return;
    if (sessionStorage.getItem(UNLOCK_KEY) !== "1") return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(CHANNEL);
    } catch {
      return;
    }
    channel.onmessage = (event) => {
      if (event.data === "ask") channel.postMessage("yes");
    };
    return () => channel.close();
  }, [locked]);

  useLayoutEffect(() => {
    if (window.location.pathname.startsWith("/notes")) setTitle("פתקים");
    const mac = isMac();
    setBiometric(mac ? "Touch ID" : "Face ID");
    const fromDock = window.location.hash === "#entry";
    if (fromDock) {
      sessionStorage.setItem(APP_KEY, "1");
      const next = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", next);
    }
    const macApp = mac && (fromDock || sessionStorage.getItem(APP_KEY) === "1");
    if (!isIosHomeApp() && !macApp) return;
    if (sessionStorage.getItem(UNLOCK_KEY) === "1" || iosResumeWithoutFaceId()) {
      markUnlocked();
      return;
    }

    const cached = readCreds();
    credsRef.current = cached;
    if (cached.length) setReady(true);
    setLocked(true);

    if (macApp) {
      void askOpenTab().then((open) => {
        if (!open) return;
        markUnlocked();
        setLocked(false);
      });
    }

    void fetch("/api/auth/passkey/presence", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          setLocked(false);
          return;
        }
        const data = (await res.json()) as { credentials?: PresenceCredential[] };
        const creds = Array.isArray(data.credentials) ? data.credentials : [];
        credsRef.current = creds;
        writeCreds(creds);
        if (!creds.length) {
          markUnlocked();
          setLocked(false);
          return;
        }
        setReady(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isIosHomeApp()) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") markIosHidden();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", markIosHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", markIosHidden);
    };
  }, []);

  async function onOpen() {
    const creds = credsRef.current.length ? credsRef.current : readCreds();
    if (!creds.length) return;
    setBusy(true);
    setError(null);
    const result = await confirmPresenceWithFaceId(creds);
    setBusy(false);
    if (result.ok) {
      markUnlocked();
      setLocked(false);
      return;
    }
    if (!result.needsGesture) setError(result.error ?? `${biometric} נכשל`);
  }

  return (
    <>
      {props.children}
      {locked ? (
        <button type="button" className="nf-chat-gate" onClick={() => void onOpen()}>
          <span className="nf-chat-gate-card">
            <span className="nf-chat-gate-icon" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M7 3.5H5.5A2 2 0 0 0 3.5 5.5V7M17 3.5h1.5A2 2 0 0 1 20.5 5.5V7M7 20.5H5.5A2 2 0 0 1 3.5 18.5V17M17 20.5h1.5a2 2 0 0 0 2-2V17" strokeLinecap="round" />
                <circle cx="12" cy="11" r="2.4" />
                <path d="M8.2 16.2c1.1-1.2 2.4-1.8 3.8-1.8s2.7.6 3.8 1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="nf-chat-gate-title">{title}</span>
            <span className="nf-chat-gate-sub">{!ready ? "רגע…" : busy ? biometric : "לחץ לפתיחה"}</span>
            {error ? <span className="nf-chat-gate-error">{error}</span> : null}
          </span>
        </button>
      ) : null}
    </>
  );
}
