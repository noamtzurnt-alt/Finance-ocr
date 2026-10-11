"use client";

import { useEffect, useState } from "react";
import { IconBell, IconShare } from "./icons";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "busy";

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function saveSubscription(sub: PushSubscription) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...sub.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
  if (!res.ok) throw new Error("save failed");
}

async function detect(): Promise<State> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (sub && Notification.permission === "granted") {
    void saveSubscription(sub).catch(() => null);
    return "on";
  }
  return "off";
}

export default function PushCard() {
  const [state, setState] = useState<State>("loading");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    detect()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setNote(null);
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const keyRes = await fetch("/api/push/subscribe");
      if (!keyRes.ok) throw new Error("no key");
      const { publicKey } = (await keyRes.json()) as { publicKey: string };
      const reg = await registration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) }));
      await saveSubscription(sub);
      setState("on");
      await fetch("/api/push/test", { method: "POST" });
    } catch {
      setNote("לא הצלחנו להפעיל התראות. נסה שוב.");
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  async function test() {
    setNote(null);
    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    setNote(res?.ok ? "נשלחה התראת ניסיון" : "השליחה נכשלה");
  }

  if (state === "loading" || state === "unsupported") return null;

  if (state === "on") {
    return (
      <div className="rem-push is-on">
        <span className="rem-push-dot" aria-hidden />
        <span className="rem-push-on-text">{note ?? "התראות פעילות במכשיר הזה"}</span>
        <button type="button" className="rem-push-link" onClick={test}>
          ניסיון
        </button>
        <button type="button" className="rem-push-link is-muted" onClick={disable}>
          כבה
        </button>
      </div>
    );
  }

  return (
    <div className="rem-push">
      <span className="rem-push-icon" aria-hidden>
        <IconBell className="h-5.5 w-5.5" />
      </span>
      <div className="rem-push-text">
        <strong>{state === "ios-install" ? "התראות באייפון" : state === "denied" ? "ההתראות חסומות" : "קבל התראה בזמן"}</strong>
        {state === "ios-install" ? (
          <span>
            הקש על <IconShare className="rem-push-inline" /> שיתוף ← &quot;הוסף למסך הבית&quot;, פתח את האפליקציה מהאייקון וחזור לכאן.
          </span>
        ) : state === "denied" ? (
          <span>אפשר להפעיל מחדש בהגדרות המכשיר ← התראות ← Noam Finance.</span>
        ) : (
          <span>{note ?? "הטלפון יצלצל כשמגיע מועד התזכורת, וגם בהתראה המוקדמת."}</span>
        )}
      </div>
      {state === "off" || state === "busy" ? (
        <button type="button" className="rem-push-btn" onClick={enable} disabled={state === "busy"}>
          {state === "busy" ? "…" : "הפעל"}
        </button>
      ) : null}
    </div>
  );
}
