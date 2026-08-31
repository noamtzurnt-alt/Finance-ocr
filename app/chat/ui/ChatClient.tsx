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

type PaymentPick = { id: string; label: string; value: string };

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
  const [activePaymentMsgId, setActivePaymentMsgId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPick | null>(null);
  const [paymentCustomMode, setPaymentCustomMode] = useState(false);
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
  }, [messages, selectedPayment, paymentCustomMode, text]);

  function resetPaymentFlow() {
    setPendingPaymentTxId(null);
    setActivePaymentMsgId(null);
    setSelectedPayment(null);
    setPaymentCustomMode(false);
  }

  function disablePaymentOptions() {
    setMessages((prev) =>
      prev.map((m) => (m.paymentOptions ? { ...m, paymentDisabled: true } : m)),
    );
    resetPaymentFlow();
  }

  async function submitPayment(transactionId: string, paymentMethod: string, userLabel: string) {
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text: userLabel, status: "ok" },
      { id: pendingId, role: "bot", text: "…", status: "sending" },
    ]);
    disablePaymentOptions();
    setText("");

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

  function pickPaymentOption(option: PaymentPick) {
    if (!pendingPaymentTxId || busy) return;

    if (isOtherPaymentOption(option.id)) {
      setSelectedPayment(option);
      setPaymentCustomMode(true);
      setText("");
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    setPaymentCustomMode(false);
    setSelectedPayment(option);
    setText("");
  }

  function backToPaymentOptions() {
    setPaymentCustomMode(false);
    setSelectedPayment(null);
    setText("");
    inputRef.current?.focus({ preventScroll: true });
  }

  function clearPaymentSelection() {
    setSelectedPayment(null);
    setPaymentCustomMode(false);
    setText("");
  }

  function confirmPaymentSelection() {
    if (!pendingPaymentTxId || busy) return;

    if (paymentCustomMode) {
      const custom = text.trim();
      if (!custom) return;
      void submitPayment(pendingPaymentTxId, custom, custom);
      return;
    }

    if (!selectedPayment || isOtherPaymentOption(selectedPayment.id)) return;
    void submitPayment(pendingPaymentTxId, selectedPayment.value, selectedPayment.label);
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
    disablePaymentOptions();

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
        setActivePaymentMsgId(pendingId);
        setSelectedPayment(null);
        setPaymentCustomMode(false);
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

    if (paymentCustomMode && pendingPaymentTxId) {
      await submitPayment(pendingPaymentTxId, value, value);
      return;
    }

    await sendExpense(value);
  }

  const inputPlaceholder = paymentCustomMode ? "הקלד אמצעי תשלום…" : "הקלד הודעה…";
  const canConfirmPreset = Boolean(
    selectedPayment && !paymentCustomMode && !isOtherPaymentOption(selectedPayment.id),
  );
  const canConfirmCustom = Boolean(paymentCustomMode && text.trim());

  return (
    <div className="nf-chat-page">
      <ChatTopBar />

      <div className="nf-chat-thread">
        <div ref={listRef} className="nf-chat-messages" role="log" aria-live="polite">
          {messages.map((m) => {
            const isActivePayment =
              m.paymentOptions && m.id === activePaymentMsgId && !m.paymentDisabled;

            return (
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
                    <>
                      {isActivePayment && paymentCustomMode && (
                        <p className="nf-payment-custom-hint">{CHAT_PAYMENT_OTHER_PROMPT}</p>
                      )}
                      <div className="nf-payment-options">
                        {CHAT_PAYMENT_OPTIONS.map((option) => {
                          const isSelected = isActivePayment && selectedPayment?.id === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`nf-payment-option${isSelected ? " is-selected" : ""}`}
                              disabled={busy || m.paymentDisabled}
                              onClick={() => pickPaymentOption(option)}
                            >
                              <span className="nf-payment-option-label">{option.label}</span>
                              {isSelected && (
                                <span className="nf-payment-option-check" aria-hidden="true">
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {isActivePayment && (
                        <div className="nf-payment-actions">
                          {paymentCustomMode ? (
                            <>
                              <button
                                type="button"
                                className="nf-payment-back"
                                disabled={busy}
                                onClick={backToPaymentOptions}
                              >
                                חזרה לבחירה
                              </button>
                              {canConfirmCustom && (
                                <button
                                  type="button"
                                  className="nf-payment-confirm"
                                  disabled={busy}
                                  onClick={confirmPaymentSelection}
                                >
                                  אישור
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {selectedPayment && (
                                <button
                                  type="button"
                                  className="nf-payment-back"
                                  disabled={busy}
                                  onClick={clearPaymentSelection}
                                >
                                  ביטול
                                </button>
                              )}
                              {canConfirmPreset && (
                                <button
                                  type="button"
                                  className="nf-payment-confirm"
                                  disabled={busy}
                                  onClick={confirmPaymentSelection}
                                >
                                  אישור
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form
        ref={composerRef}
        className="nf-chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (paymentCustomMode && canConfirmCustom) {
            confirmPaymentSelection();
            return;
          }
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
          enterKeyHint={paymentCustomMode ? "done" : "send"}
          inputMode="text"
          className="nf-chat-input"
        />
        <button
          type="submit"
          className="nf-chat-send"
          disabled={
            busy ||
            (paymentCustomMode ? !canConfirmCustom : !text.trim())
          }
          aria-label={paymentCustomMode ? "אישור" : "שלח"}
        >
          {paymentCustomMode ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M3.4 20.6 21 12 3.4 3.4l.1 6.8L15 12 3.5 13.8z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
