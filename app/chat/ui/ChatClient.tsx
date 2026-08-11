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

export default function ChatClient() {
  const inputId = useId();
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
    document.documentElement.classList.add("nf-chat-active");
    document.body.classList.add("nf-chat-active");
    return () => {
      document.documentElement.classList.remove("nf-chat-active");
      document.body.classList.remove("nf-chat-active");
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

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
      inputRef.current?.focus();
    }
  }

  return (
    <div className="nf-chat">
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
          placeholder="קוטג 10 שקלים…"
          autoComplete="off"
          enterKeyHint="send"
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
