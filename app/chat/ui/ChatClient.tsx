"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CHAT_WELCOME, formatChatFailure } from "@/app/lib/transactions/parse-quick";

type Msg = {
  id: string;
  role: "user" | "bot";
  text: string;
  status?: "sending" | "ok" | "error";
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function scrollMessagesToEnd(el: HTMLDivElement | null) {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

export default function ChatClient() {
  const inputId = useId();
  const shellRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "bot",
      text: CHAT_WELCOME,
      status: "ok",
    },
  ]);
  const [showInstall, setShowInstall] = useState(false);
  const [, startTransition] = useTransition();
  const busy = messages.some((m) => m.status === "sending");

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("nf-chat-active");
    body.classList.add("nf-chat-active");

    const theme = document.createElement("meta");
    theme.setAttribute("name", "theme-color");
    theme.setAttribute("content", "#061018");
    theme.setAttribute("data-nf-chat-theme", "1");
    document.head.appendChild(theme);

    const scrollY = window.scrollY;
    html.style.setProperty("color-scheme", "dark");
    body.style.setProperty("color-scheme", "dark");
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.inset = "0";
    body.style.width = "100%";
    body.style.height = "100%";
    window.scrollTo(0, 0);

    return () => {
      html.classList.remove("nf-chat-active");
      body.classList.remove("nf-chat-active");
      html.style.removeProperty("color-scheme");
      body.style.removeProperty("color-scheme");
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.position = "";
      body.style.inset = "";
      body.style.width = "";
      body.style.height = "";
      document.querySelectorAll('meta[data-nf-chat-theme="1"]').forEach((n) => n.remove());
      window.scrollTo(0, scrollY);
    };
  }, []);

  /**
   * Only lift the composer above the keyboard.
   * Header + message list stay put — no full-page resize/jump.
   */
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let raf = 0;
    let lastInset = -1;

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        if (!vv) {
          shell.style.setProperty("--kb-inset", "0px");
          return;
        }
        const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        const inset = covered >= 120 ? covered : 0;
        if (inset === lastInset) return;
        lastInset = inset;
        shell.style.setProperty("--kb-inset", `${inset}px`);
      });
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    scrollMessagesToEnd(listRef.current);
  }, [messages]);

  async function send(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;

    const userMsg: Msg = { id: uid(), role: "user", text: value, status: "ok" };
    const pendingId = uid();

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: "bot", text: "…", status: "sending" },
    ]);
    setText("");

    try {
      const res = await fetch("/api/chat/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; reply?: string; error?: string }
        | null;

      const reply =
        data?.reply ||
        (res.status === 401
          ? formatChatFailure("צריך להתחבר מחדש כדי להוסיף תנועה.")
          : formatChatFailure(data?.error || `שגיאת שרת (${res.status})`));

      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  text: reply,
                  status: data?.ok ? "ok" : "error",
                }
              : m,
          ),
        );
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "אין חיבור לרשת";
      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, text: formatChatFailure(msg), status: "error" }
              : m,
          ),
        );
      });
    } finally {
      inputRef.current?.focus({ preventScroll: true });
      requestAnimationFrame(() => scrollMessagesToEnd(listRef.current));
    }
  }

  return (
    <>
      <div className="nf-chat-underlay" aria-hidden />
      <div ref={shellRef} className="nf-chat">
        <header className="nf-chat-header">
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
        </header>

        {showInstall && (
          <div className="nf-chat-install">
            <p className="font-semibold text-white">חשוב: שמור את הקישור של הצ׳אט</p>
            <ol>
              <li>
                פתח בדיוק: <strong>/chat</strong> (לא את המסך הראשי).
              </li>
              <li>
                Safari → שיתוף → <strong>הוסף למסך הבית</strong>.
              </li>
              <li>
                לווידג׳ט: אפליקציית <strong>קיצורים</strong> → Open URL → אותה כתובת `/chat`.
              </li>
            </ol>
            <p className="nf-chat-install-note">
              רק מ־“הוסף למסך הבית” נעלם סרגל Safari הלבן למטה. בטאב רגיל הסרגל שייך לדפדפן.
            </p>
            <button
              type="button"
              className="nf-chat-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/chat`);
                } catch {
                  /* ignore */
                }
              }}
            >
              העתק קישור לצ׳אט
            </button>
          </div>
        )}

        <div ref={listRef} className="nf-chat-messages" role="log" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`nf-bubble-row ${m.role === "user" ? "is-user" : "is-bot"}`}>
              {m.role === "bot" && (
                <Image
                  src="/noam-finance-bot.webp"
                  alt=""
                  width={28}
                  height={28}
                  className="nf-bubble-avatar"
                />
              )}
              <div
                className={`nf-bubble ${m.role === "user" ? "nf-bubble-user" : "nf-bubble-bot"} ${
                  m.status === "sending" ? "is-sending" : ""
                } ${m.status === "error" ? "is-error" : ""}`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <form
          className="nf-chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            הודעה
          </label>
          <input
            id={inputId}
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => {
              e.target.focus({ preventScroll: true });
              window.scrollTo(0, 0);
            }}
            placeholder="קוטג 10 / תמחק סרט 100…"
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck
            enterKeyHint="send"
            inputMode="text"
            className="nf-chat-input"
          />
          <button type="submit" className="nf-chat-send" disabled={!text.trim() || busy} aria-label="שלח">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M3.4 20.6 21 12 3.4 3.4l.1 6.8L15 12 3.5 13.8z" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
