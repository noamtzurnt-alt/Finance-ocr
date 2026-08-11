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

function scrollMessagesToEnd(el: HTMLDivElement | null, smooth = true) {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
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

  // Lock page scroll + paint dark chrome so iOS keyboard can't shove the whole document.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("nf-chat-active");
    body.classList.add("nf-chat-active");
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyWidth = body.style.width;
    const prevBodyTop = body.style.top;
    const scrollY = window.scrollY;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    body.style.top = `-${scrollY}px`;

    return () => {
      html.classList.remove("nf-chat-active");
      body.classList.remove("nf-chat-active");
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.width = prevBodyWidth;
      body.style.top = prevBodyTop;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Keep the chat shell glued to the *visible* viewport (above the iPhone keyboard).
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const sync = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      shell.style.height = `${Math.round(height)}px`;
      shell.style.top = `${Math.round(offsetTop)}px`;
      shell.style.bottom = "auto";
      // When keyboard opens, keep latest messages above the composer.
      scrollMessagesToEnd(listRef.current, false);
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  useEffect(() => {
    scrollMessagesToEnd(listRef.current, true);
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
      // Keep keyboard open after send (WhatsApp-like).
      inputRef.current?.focus({ preventScroll: true });
      requestAnimationFrame(() => scrollMessagesToEnd(listRef.current, false));
    }
  }

  return (
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
            אם האייקון הישן פותח את הדשבורד — מחק אותו והוסף מחדש מתוך מסך הצ׳אט הזה.
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
          onFocus={() => {
            // After iOS finishes opening the keyboard, re-sync + scroll.
            window.setTimeout(() => scrollMessagesToEnd(listRef.current, false), 50);
            window.setTimeout(() => scrollMessagesToEnd(listRef.current, false), 300);
          }}
          placeholder="קוטג 10 שקלים…"
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
  );
}
