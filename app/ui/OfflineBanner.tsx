"use client";

import { useEffect, useState } from "react";

/**
 * Offline detection and banner – like major apps:
 * - When offline: persistent, clear banner so user knows and has a good experience.
 * - When back online: brief "reconnected" message, then hide.
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let reconnectedTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      if (reconnectedTimer) clearTimeout(reconnectedTimer);
      reconnectedTimer = setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      if (reconnectedTimer) clearTimeout(reconnectedTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-neutral-800 text-white px-4 py-3 text-sm shadow-lg"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden />
        <span>אין חיבור לאינטרנט. חלק מהפעולות לא יהיו זמינות עד לחידוש החיבור.</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg"
        style={{ top: "max(1rem, calc(0.5rem + env(safe-area-inset-top)))" }}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-white" aria-hidden />
        <span>חיבור חודש – הנתונים מעודכנים</span>
      </div>
    );
  }

  return null;
}
