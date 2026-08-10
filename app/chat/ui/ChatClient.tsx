"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { parseQuickTransaction, QUICK_HELP } from "@/app/lib/transactions/parse-quick";

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
      text: "היי, אני Noam Finance.\nכתוב הוצאה ואני אוסיף אותה לתנועות מיד.\nלדוגמה: קוטג 10 שקלים",
      status: "ok",
    },
  ]);
  const [showInstall, setShowInstall] = useState(false);
  const [, startTransition] = useTransition();
  const busy = messages.some((m) => m.status === "sending");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Focus instantly so typing feels like WhatsApp.
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  async function send(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;

    const userMsg: Msg = { id: uid(), role: "user", text: value, status: "ok" };
    const pendingId = uid();
    const local = parseQuickTransaction(value);

    // Optimistic bot reply for instant feel when parse succeeds.
    const optimistic: Msg = local
      ? {
          id: pendingId,
          role: "bot",
          text: `רגע… מוסיף: ${local.vendor} — ${local.amount.toFixed(2)} ${local.currency === "ILS" ? "₪" : local.currency === "USD" ? "$" : "€"}`,
          status: "sending",
        }
      : {
          id: pendingId,
          role: "bot",
          text: "…",
          status: "sending",
        };

    setMessages((prev) => [...prev, userMsg, optimistic]);
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

      if (!res.ok) {
        throw new Error(data?.error || "שגיאה");
      }

      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  text: data?.reply || QUICK_HELP,
                  status: data?.ok === false ? "error" : "ok",
                }
              : m,
          ),
        );
      });
    } catch {
      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, text: "אופס, לא הצלחתי לשמור. נסה שוב.", status: "error" }
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
        <Link href="/dashboard" className="nf-chat-back" aria-label="חזרה לדשבורד">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="nf-chat-identity">
          <Image
            src="/noam-finance-bot.webp"
            alt="Noam Finance"
            width={40}
            height={40}
            className="nf-chat-avatar"
            priority
          />
          <div className="min-w-0">
            <div className="nf-chat-name">Noam Finance</div>
            <div className="nf-chat-status">מחובר · תשובה מיידית</div>
          </div>
        </div>
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
          <p className="font-semibold text-white">הוספה למסך הבית / Widget</p>
          <ol>
            <li>
              Safari → כפתור שיתוף → <strong>הוסף למסך הבית</strong> (ייפתח ישר ל־Noam Finance).
            </li>
            <li>
              ל־Widget במסך נעילה: אפליקציית <strong>קיצורים</strong> → קיצור חדש → פעולת{" "}
              <strong>Open URLs</strong> עם הקישור הזה → הוסף ל־Home Screen / Lock Screen Widget.
            </li>
          </ol>
          <p className="nf-chat-install-note">
            iOS לא מאפשר וידג׳ט אמיתי מאפליקציית ווב — קיצור דרך שפותח את הצ׳אט הוא הפתרון המהיר ביותר.
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
