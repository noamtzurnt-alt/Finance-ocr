"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function ChatTopBar() {
  const barRef = useRef<HTMLElement>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const setHeight = () => {
      document.documentElement.style.setProperty("--nf-topbar-h", `${el.offsetHeight}px`);
    };

    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showInstall]);

  return (
    <header ref={barRef} className="nf-chat-topbar">
      <div className="nf-chat-topbar-inner">
        <div className="nf-chat-identity">
          <Image
            src="/noam-finance-bot.webp"
            alt="Noam Finance"
            width={44}
            height={44}
            className="nf-chat-avatar"
            priority
          />
          <div className="min-w-0">
            <div className="nf-chat-name">Noam Finance</div>
            <div className="nf-chat-status">מחובר · תשובה מיידית</div>
          </div>
        </div>
        <Link href="/dashboard" className="nf-chat-dash" prefetch>
          לאפליקציה
        </Link>
        <button
          type="button"
          className="nf-chat-install-btn"
          onClick={() => setShowInstall((v) => !v)}
          aria-expanded={showInstall}
        >
          למסך הבית
        </button>
      </div>

      {showInstall && (
        <div className="nf-chat-install">
          <p className="font-semibold text-white">הוספה למסך הבית + ווידג׳ט</p>
          <ol>
            <li>
              פתח בדיוק: <strong>/chat</strong> (לא את המסך הראשי).
            </li>
            <li>
              Safari → שיתוף → <strong>הוסף למסך הבית</strong> → הוסף.
            </li>
            <li>
              לווידג׳ט: אפליקציית <strong>קיצורים</strong> → + → <strong>Open URL</strong>.
            </li>
            <li>
              הדבק את הקישור לצ׳אט, שם: <strong>Noam Finance</strong>, הוסף לווידג׳ט.
            </li>
            <li>
              לחץ ארוך על מסך הבית → <strong>ערוך</strong> → גרור את הקיצור למסך.
            </li>
          </ol>
          <p className="nf-chat-install-note">
            רק מ־"הוסף למסך הבית" נעלם סרגל Safari הלבן למטה. הווידג׳ט פותח ישר את הצ׳אט.
          </p>
          <button
            type="button"
            className="nf-chat-copy"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}/chat`);
              } catch {
                /* */
              }
            }}
          >
            העתק קישור לצ׳אט
          </button>
        </div>
      )}

      <div className="nf-chat-topbar-divider" aria-hidden="true" />
    </header>
  );
}
