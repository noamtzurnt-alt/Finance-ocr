"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  CHAT_PAYMENT_OTHER_PROMPT,
  CHAT_WELCOME,
  formatChatFailure,
} from "@/app/lib/transactions/parse-quick";
import {
  CHAT_PAYMENT_OPTIONS,
  isOtherPaymentOption,
} from "@/app/lib/transactions/chat-payment";
import ChatTopBar from "./ChatTopBar";

type Msg = {
  id: string;
  role: "user" | "bot";
  text: string;
  status?: "sending" | "ok" | "error";
  paymentOptions?: boolean;
  paymentDisabled?: boolean;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatClient() {
  const inputId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { id: "welcome", role: "bot", text: CHAT_WELCOME, status: "ok" },
  ]);
  const [pendingPaymentTxId, setPendingPaymentTxId] = useState<string | null>(null);
  const [awaitingCustomPayment, setAwaitingCustomPayment] = useState(false);
  const [, startTransition] = useTransition();
  const busy = messages.some((m) => m.status === "sending");

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("nf-chat-active");
    body.classList.add("nf-chat-active");

    const theme = document.createElement("meta");
    theme.setAttribute("name", "theme-color");
    theme.setAttribute("content", "#0b1c2a");
    theme.setAttribute("data-nf-chat-theme", "1");
    document.head.appendChild(theme);

    return () => {
      html.classList.remove("nf-chat-active");
      body.classList.remove("nf-chat-active");
      document.querySelectorAll('meta[data-nf-chat-theme="1"]').forEach((n) => n.remove());
      html.style.removeProperty("--kb-inset");
      html.style.removeProperty("--nf-topbar-h");
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let lastKey = "";

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        if (vv.offsetTop > 0) {
          window.scrollTo(0, 0);
        }

        const composerH = composerRef.current?.offsetHeight ?? 58;
        const kb = Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height));
        const key = `${kb}`;
        if (key === lastKey) return;
        lastKey = key;

        root.style.setProperty("--kb-inset", `${kb}px`);
        root.style.setProperty("--composer-h", `${composerH}px`);
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
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function disablePaymentOptions() {
    setMessages((prev) =>
      prev.map((m) => (m.paymentOptions ? { ...m, paymentDisabled: true } : m)),
    );
  }

  async function submitPayment(transactionId: string, paymentMethod: string, userLabel: string) {
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text: userLabel, status: "ok" },
      { id: pendingId, role: "bot", text: "…", status: "sending" },
    ]);
    disablePaymentOptions();
    setPendingPaymentTxId(null);
    setAwaitingCustomPayment(false);

    try {
      const res = await fetch("/api/chat/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, paymentMethod }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; reply?: string }
        | null;

      const reply =
        data?.reply ||
        (res.status === 401
          ? "לא עודכן\nצריך להתחבר מחדש."
          : `לא עודכן\nשגיאת שרת (${res.status})`);

      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, text: reply, status: data?.ok ? "ok" : "error" }
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
              ? { ...m, text: `לא עודכן\n${msg}`, status: "error" }
              : m,
          ),
        );
      });
    } finally {
      inputRef.current?.focus({ preventScroll: true });
    }
  }

  function pickPaymentOption(optionId: string, label: string, value: string) {
    if (!pendingPaymentTxId || busy) return;

    if (isOtherPaymentOption(optionId)) {
      disablePaymentOptions();
      setAwaitingCustomPayment(true);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", text: label, status: "ok" },
        { id: uid(), role: "bot", text: CHAT_PAYMENT_OTHER_PROMPT, status: "ok" },
      ]);
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    void submitPayment(pendingPaymentTxId, value, label);
  }

  async function sendExpense(raw: string) {
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
    setAwaitingCustomPayment(false);
    disablePaymentOptions();
    setPendingPaymentTxId(null);

    try {
      const res = await fetch("/api/chat/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            reply?: string;
            step?: string;
            transaction?: { id: string };
          }
        | null;

      const reply =
        data?.reply ||
        (res.status === 401
          ? formatChatFailure("צריך להתחבר מחדש כדי להוסיף תנועה.")
          : formatChatFailure(`שגיאת שרת (${res.status})`));

      const needsPayment = Boolean(data?.ok && data.step === "payment" && data.transaction?.id);

      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  text: reply,
                  status: data?.ok ? "ok" : "error",
                  paymentOptions: needsPayment,
                  paymentDisabled: false,
                }
              : m,
          ),
        );
      });

      if (needsPayment && data?.transaction?.id) {
        setPendingPaymentTxId(data.transaction.id);
      }
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
    }
  }

  async function send(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;

    if (awaitingCustomPayment && pendingPaymentTxId) {
      setText("");
      await submitPayment(pendingPaymentTxId, value, value);
      return;
    }

    await sendExpense(value);
  }

  const inputPlaceholder = awaitingCustomPayment ? "אמצעי תשלום…" : "הקלד הודעה…";

  return (
    <div className="nf-chat-page">
      <ChatTopBar />

      <div className="nf-chat-thread">
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
                {m.paymentOptions && (
                  <div className="nf-payment-options">
                    {CHAT_PAYMENT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="nf-payment-option"
                        disabled={busy || m.paymentDisabled}
                        onClick={() => pickPaymentOption(option.id, option.label, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form
        ref={composerRef}
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
          onFocus={(e) => e.target.focus({ preventScroll: true })}
          placeholder={inputPlaceholder}
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck
          enterKeyHint="send"
          inputMode="text"
          className="nf-chat-input"
        />
        <button
          type="submit"
          className="nf-chat-send"
          disabled={!text.trim() || busy}
          aria-label="שלח"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M3.4 20.6 21 12 3.4 3.4l.1 6.8L15 12 3.5 13.8z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
