"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CHAT_PAYMENT_OTHER_PROMPT,
  CHAT_WELCOME,
  formatChatFailure,
} from "@/app/lib/transactions/parse-quick";
import type { ChatEditField } from "@/app/lib/transactions/chat-commands";
import { parseTransactionIndex } from "@/app/lib/transactions/chat-commands";
import {
  CHAT_ADD_PLACEHOLDER,
  CHAT_ADD_PROMPT,
  CHAT_DELETE_PLACEHOLDER,
  CHAT_DELETE_PROMPT,
  CHAT_EDIT_INDEX_PLACEHOLDER,
  CHAT_EDIT_INDEX_PROMPT,
  CHAT_EDIT_PROMPT,
  CHAT_FLOW_IDLE,
  CHAT_MENU_FOLLOWUP,
  BACK_TO_MENU_OPTION,
  EDIT_FIELD_MENU_OPTIONS,
  MAIN_MENU_OPTIONS,
  editFieldToCommand,
  inlineInputKindForEditField,
  inlinePlaceholderForEditField,
  menuIdToEditField,
  type ChatFlow,
  type InlineInputKind,
  type MenuOption,
} from "@/app/lib/transactions/chat-menu";
import ChatInlineInput from "./ChatInlineInput";
import {
  CHAT_PAYMENT_OPTIONS,
  isOtherPaymentOption,
} from "@/app/lib/transactions/chat-payment";
import { isEmptyTransactionListReply } from "@/app/lib/transactions/chat-list";
import ChatMenuButtons from "./ChatMenuButtons";
import ChatTopBar from "./ChatTopBar";

type PaymentPick = { id: string; label: string; value: string };

type PendingEdit = {
  transactionId: string;
  field: Exclude<ChatEditField, "payment">;
  index: number;
};

type Msg = {
  id: string;
  role: "user" | "bot";
  text: string;
  status?: "sending" | "ok" | "error";
  paymentOptions?: boolean;
  paymentDisabled?: boolean;
  menuOptions?: MenuOption[];
  menuDisabled?: boolean;
  inlineInput?: InlineInputKind;
  inlinePlaceholder?: string;
  inlineDisabled?: boolean;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function botErrorFields(text: string): Pick<Msg, "text" | "status" | "menuOptions" | "menuDisabled"> {
  return {
    text,
    status: "error",
    menuOptions: [BACK_TO_MENU_OPTION],
    menuDisabled: false,
  };
}

function applyKeyboardInset(page: HTMLElement, rawKb: number) {
  const kb = rawKb > 80 ? rawKb : 0;
  const open = kb > 0;
  page.dataset.kbOpen = open ? "true" : "false";
  const inset = open ? Math.max(0, kb - 12) : 0;
  page.style.setProperty("--kb-inset", `${inset}px`);
  return kb;
}

function syncBottomReserve(page: HTMLElement, inlineActive: boolean, kb: number) {
  if (inlineActive) {
    page.style.setProperty("--chat-bottom-reserve", `${kb > 0 ? kb + 36 : 36}px`);
    return;
  }
  page.style.setProperty(
    "--chat-bottom-reserve",
    "calc(1rem + env(safe-area-inset-bottom, 0px))",
  );
}

export default function ChatClient() {
  const pageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "bot",
      text: CHAT_WELCOME,
      status: "ok",
      menuOptions: MAIN_MENU_OPTIONS,
    },
  ]);
  const [flow, setFlow] = useState<ChatFlow>(CHAT_FLOW_IDLE);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>("welcome");
  const [pendingPaymentTxId, setPendingPaymentTxId] = useState<string | null>(null);
  const [activePaymentMsgId, setActivePaymentMsgId] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPick | null>(null);
  const [paymentCustomMode, setPaymentCustomMode] = useState(false);
  const [activeInlineMsgId, setActiveInlineMsgId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState("");
  const [, startTransition] = useTransition();
  const busy = messages.some((m) => m.status === "sending");
  const stickToBottomRef = useRef(true);
  const layoutStateRef = useRef({ inlineMode: false, activeInlineId: null as string | null });
  layoutStateRef.current = {
    inlineMode: Boolean(activeInlineMsgId),
    activeInlineId: activeInlineMsgId,
  };

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
    };
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const kb = Number.parseFloat(page.style.getPropertyValue("--kb-inset")) || 0;
    syncBottomReserve(page, Boolean(activeInlineMsgId), kb);
  }, [activeInlineMsgId]);

  const scrollInlineInputIntoView = useCallback((msgId: string, behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;
    const page = pageRef.current;
    if (!list || !page) return;

    const target = list.querySelector<HTMLElement>(`[data-inline-msg="${msgId}"]`);
    if (!target) return;

    const vv = window.visualViewport;
    const kb = Number.parseFloat(page.style.getPropertyValue("--kb-inset")) || 0;
    const padding = 24;
    const visibleBottom = vv ? vv.offsetTop + vv.height - padding : window.innerHeight - kb - padding;
    const listRect = list.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    if (targetRect.bottom > visibleBottom) {
      list.scrollBy({ top: targetRect.bottom - visibleBottom, behavior });
    } else if (targetRect.top < listRect.top + padding) {
      list.scrollBy({ top: targetRect.top - (listRect.top + padding), behavior });
    }
  }, []);

  const scrollInlineRef = useRef(scrollInlineInputIntoView);
  scrollInlineRef.current = scrollInlineInputIntoView;

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    let raf = 0;

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        const rawKb = Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height));
        const kb = rawKb > 80 ? rawKb : 0;

        applyKeyboardInset(page, rawKb);
        syncBottomReserve(page, layoutStateRef.current.inlineMode, kb);

        const inlineId = layoutStateRef.current.activeInlineId;
        if (inlineId) {
          scrollInlineRef.current(inlineId, "auto");
        }
      });
    };

    const scheduleSync = () => {
      sync();
      [50, 150, 300, 500].forEach((ms) => window.setTimeout(sync, ms));
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", scheduleSync);
    window.addEventListener("resize", sync);

    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", scheduleSync);
      window.removeEventListener("resize", sync);
      page.style.removeProperty("--kb-inset");
      delete page.dataset.kbOpen;
    };
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth", force = false) => {
    if (!force && !stickToBottomRef.current) return;
    const el = listRef.current;
    if (!el) return;
    const run = () => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    };
    run();
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 96;
  }, []);

  useEffect(() => {
    if (layoutStateRef.current.activeInlineId) return;
    scrollToBottom(messages.length <= 2 ? "auto" : "smooth");
  }, [messages, selectedPayment, paymentCustomMode, activeMenuMsgId, activePaymentMsgId, scrollToBottom]);

  useEffect(() => {
    if (!activeInlineMsgId) return;
    stickToBottomRef.current = false;
    const focusAndScroll = () => {
      document
        .querySelector<HTMLInputElement>(`[data-inline-msg="${activeInlineMsgId}"] .nf-inline-input`)
        ?.focus({ preventScroll: true });
      scrollInlineInputIntoView(activeInlineMsgId, "auto");
    };
    const timers = [80, 200, 400].map((ms) => window.setTimeout(focusAndScroll, ms));
    return () => timers.forEach(clearTimeout);
  }, [activeInlineMsgId, scrollInlineInputIntoView]);

  const disableActiveMenus = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.menuOptions ? { ...m, menuDisabled: true } : m)),
    );
    setActiveMenuMsgId(null);
  }, []);

  const disableActiveInlines = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.inlineInput ? { ...m, inlineDisabled: true } : m)),
    );
    setActiveInlineMsgId(null);
    setInlineDraft("");
  }, []);

  const activateInline = useCallback((msgId: string) => {
    setActiveInlineMsgId(msgId);
    setInlineDraft("");
  }, []);

  const appendBotMessage = useCallback(
    (botMsg: Omit<Msg, "role">) => {
      setMessages((prev) => [...prev, { ...botMsg, role: "bot" }]);
      if (botMsg.menuOptions?.length) {
        setActiveMenuMsgId(botMsg.id);
      }
      return botMsg.id;
    },
    [],
  );

  const showFollowUpMenu = useCallback(() => {
    setFlow(CHAT_FLOW_IDLE);
    appendBotMessage({
      id: uid(),
      text: CHAT_MENU_FOLLOWUP,
      status: "ok",
      menuOptions: MAIN_MENU_OPTIONS,
    });
  }, [appendBotMessage]);

  const activateErrorMenu = useCallback((pendingId: string) => {
    setFlow(CHAT_FLOW_IDLE);
    setActiveMenuMsgId(pendingId);
  }, []);

  const resetPaymentFlow = useCallback(() => {
    setPendingPaymentTxId(null);
    setActivePaymentMsgId(null);
    setSelectedPayment(null);
    setPaymentCustomMode(false);
  }, []);

  const resetEditFlow = useCallback(() => {
    setPendingEdit(null);
  }, []);

  const resetPendingFlows = useCallback(() => {
    resetPaymentFlow();
    resetEditFlow();
  }, [resetPaymentFlow, resetEditFlow]);

  const disablePaymentOptions = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.paymentOptions ? { ...m, paymentDisabled: true } : m)),
    );
    resetPaymentFlow();
  }, [resetPaymentFlow]);

  const fetchListReply = useCallback(async () => {
    const res = await fetch("/api/chat/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "הצג את כל התנועות שלי" }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; reply?: string } | null;
    if (!data?.ok || !data.reply) {
      return (
        data?.reply ||
        (res.status === 401
          ? formatChatFailure("צריך להתחבר מחדש.")
          : formatChatFailure(`שגיאת שרת (${res.status})`))
      );
    }
    return data.reply;
  }, []);

  const runQuickCommand = useCallback(
    async (
      command: string,
      opts?: { showMenuOnComplete?: boolean },
    ): Promise<{ ok: boolean; needsPayment?: boolean; transactionId?: string; pendingId?: string; edit?: PendingEdit }> => {
      const pendingId = uid();
      setMessages((prev) => [
        ...prev,
        { id: pendingId, role: "bot", text: "…", status: "sending" },
      ]);
      resetPendingFlows();

      try {
        const res = await fetch("/api/chat/quick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: command }),
        });
        const data = (await res.json().catch(() => null)) as
          | {
              ok?: boolean;
              reply?: string;
              step?: string;
              transaction?: { id: string };
              edit?: PendingEdit;
            }
          | null;

        const reply =
          data?.reply ||
          (res.status === 401
            ? formatChatFailure("צריך להתחבר מחדש.")
            : formatChatFailure(`שגיאת שרת (${res.status})`));

        const needsPayment = Boolean(
          data?.ok &&
            (data.step === "payment" || data.step === "edit_payment") &&
            data.transaction?.id,
        );
        const isOk = Boolean(data?.ok);

        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    ...m,
                    text: reply,
                    status: isOk ? "ok" : "error",
                    paymentOptions: needsPayment,
                    paymentDisabled: false,
                    ...(isOk ? {} : { menuOptions: [BACK_TO_MENU_OPTION], menuDisabled: false }),
                  }
                : m,
            ),
          );
        });

        if (!isOk) {
          activateErrorMenu(pendingId);
        } else if (needsPayment && data?.transaction?.id) {
          setPendingPaymentTxId(data.transaction.id);
          setActivePaymentMsgId(pendingId);
          setSelectedPayment(null);
          setPaymentCustomMode(false);
        } else if (data?.ok && data.step === "edit_input" && data.edit) {
          setPendingEdit(data.edit);
          const kind = inlineInputKindForEditField(data.edit.field);
          const placeholder = inlinePlaceholderForEditField(data.edit.field);
          startTransition(() => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId
                  ? {
                      ...m,
                      inlineInput: kind,
                      inlinePlaceholder: placeholder,
                    }
                  : m,
              ),
            );
          });
          setActiveInlineMsgId(pendingId);
          setInlineDraft("");
        } else if (data?.ok && opts?.showMenuOnComplete !== false && !needsPayment && !data.edit) {
          showFollowUpMenu();
        }

        return {
          ok: isOk,
          needsPayment,
          transactionId: data?.transaction?.id,
          pendingId,
          edit: data?.edit,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "אין חיבור לרשת";
        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId ? { ...m, ...botErrorFields(formatChatFailure(msg)) } : m,
            ),
          );
        });
        activateErrorMenu(pendingId);
        return { ok: false };
      }
    },
    [activateErrorMenu, resetPendingFlows, showFollowUpMenu],
  );

  const submitFieldUpdate = useCallback(
    async (edit: PendingEdit, value: string) => {
      const userMsg: Msg = { id: uid(), role: "user", text: value, status: "ok" };
      const pendingId = uid();

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: "bot", text: "…", status: "sending" },
      ]);
      resetEditFlow();
      disableActiveInlines();
      setFlow(CHAT_FLOW_IDLE);

      try {
        const res = await fetch("/api/chat/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: edit.transactionId,
            field: edit.field,
            value,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; reply?: string }
          | null;

        const reply =
          data?.reply ||
          (res.status === 401
            ? formatChatFailure("צריך להתחבר מחדש.")
            : formatChatFailure(`שגיאת שרת (${res.status})`));
        const isOk = Boolean(data?.ok);

        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    ...m,
                    text: reply,
                    status: isOk ? "ok" : "error",
                    ...(isOk ? {} : { menuOptions: [BACK_TO_MENU_OPTION], menuDisabled: false }),
                  }
                : m,
            ),
          );
        });

        if (isOk) showFollowUpMenu();
        else activateErrorMenu(pendingId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "אין חיבור לרשת";
        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId ? { ...m, ...botErrorFields(formatChatFailure(msg)) } : m,
            ),
          );
        });
        activateErrorMenu(pendingId);
      }
    },
    [activateErrorMenu, disableActiveInlines, resetEditFlow, showFollowUpMenu],
  );

  const submitPayment = useCallback(
    async (transactionId: string, paymentMethod: string, userLabel: string) => {
      const pendingId = uid();
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", text: userLabel, status: "ok" },
        { id: pendingId, role: "bot", text: "…", status: "sending" },
      ]);
      disablePaymentOptions();
      setPaymentCustomMode(false);
      setActiveInlineMsgId(null);
      setInlineDraft("");
      setFlow(CHAT_FLOW_IDLE);

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
        const isOk = Boolean(data?.ok);

        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    ...m,
                    text: reply,
                    status: isOk ? "ok" : "error",
                    ...(isOk ? {} : { menuOptions: [BACK_TO_MENU_OPTION], menuDisabled: false }),
                  }
                : m,
            ),
          );
        });

        if (isOk) showFollowUpMenu();
        else activateErrorMenu(pendingId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "אין חיבור לרשת";
        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? { ...m, ...botErrorFields(`לא עודכן\n${msg}`) }
                : m,
            ),
          );
        });
        activateErrorMenu(pendingId);
      }
    },
    [activateErrorMenu, disablePaymentOptions, showFollowUpMenu],
  );

  const pickPaymentOption = (option: PaymentPick) => {
    if (!pendingPaymentTxId || busy) return;

    if (isOtherPaymentOption(option.id)) {
      setSelectedPayment(option);
      setPaymentCustomMode(true);
      setInlineDraft("");
      if (activePaymentMsgId) setActiveInlineMsgId(activePaymentMsgId);
      return;
    }

    setPaymentCustomMode(false);
    setActiveInlineMsgId(null);
    setSelectedPayment(option);
    setInlineDraft("");
  };

  const backToPaymentOptions = () => {
    setPaymentCustomMode(false);
    setSelectedPayment(null);
    setInlineDraft("");
    setActiveInlineMsgId(null);
  };

  const clearPaymentSelection = () => {
    setSelectedPayment(null);
    setPaymentCustomMode(false);
    setInlineDraft("");
    setActiveInlineMsgId(null);
  };

  const confirmPaymentSelection = () => {
    if (!pendingPaymentTxId || busy) return;
    if (!selectedPayment || isOtherPaymentOption(selectedPayment.id)) return;
    void submitPayment(pendingPaymentTxId, selectedPayment.value, selectedPayment.label);
  };

  const sendExpense = useCallback(
    async (raw: string, opts?: { showMenuOnComplete?: boolean; skipUserMessage?: boolean }) => {
      const value = raw.trim();
      if (!value || busy) return;

      const userMsg: Msg = { id: uid(), role: "user", text: value, status: "ok" };
      const pendingId = uid();

      setMessages((prev) => [
        ...prev,
        ...(opts?.skipUserMessage ? [] : [userMsg]),
        { id: pendingId, role: "bot", text: "…", status: "sending" },
      ]);
      resetPendingFlows();

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
              edit?: PendingEdit;
            }
          | null;

        const reply =
          data?.reply ||
          (res.status === 401
            ? formatChatFailure("צריך להתחבר מחדש כדי להוסיף תנועה.")
            : formatChatFailure(`שגיאת שרת (${res.status})`));

        const needsPayment = Boolean(
          data?.ok &&
            (data.step === "payment" || data.step === "edit_payment") &&
            data.transaction?.id,
        );
        const isOk = Boolean(data?.ok);

        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    ...m,
                    text: reply,
                    status: isOk ? "ok" : "error",
                    paymentOptions: needsPayment,
                    paymentDisabled: false,
                    ...(isOk ? {} : { menuOptions: [BACK_TO_MENU_OPTION], menuDisabled: false }),
                  }
                : m,
            ),
          );
        });

        if (!isOk) {
          activateErrorMenu(pendingId);
        } else if (needsPayment && data?.transaction?.id) {
          setPendingPaymentTxId(data.transaction.id);
          setActivePaymentMsgId(pendingId);
          setSelectedPayment(null);
          setPaymentCustomMode(false);
        } else if (data?.ok && data.step === "edit_input" && data.edit) {
          setPendingEdit(data.edit);
          const kind = inlineInputKindForEditField(data.edit.field);
          const placeholder = inlinePlaceholderForEditField(data.edit.field);
          startTransition(() => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId
                  ? {
                      ...m,
                      inlineInput: kind,
                      inlinePlaceholder: placeholder,
                    }
                  : m,
              ),
            );
          });
          setActiveInlineMsgId(pendingId);
          setInlineDraft("");
        } else if (
          data?.ok &&
          opts?.showMenuOnComplete !== false &&
          !needsPayment &&
          data.step !== "edit_input"
        ) {
          showFollowUpMenu();
        }

        return isOk;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "אין חיבור לרשת";
        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId ? { ...m, ...botErrorFields(formatChatFailure(msg)) } : m,
            ),
          );
        });
        activateErrorMenu(pendingId);
        return false;
      }
    },
    [activateErrorMenu, busy, resetPendingFlows, showFollowUpMenu],
  );

  const runListFromMenu = useCallback(async () => {
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: pendingId, role: "bot", text: "…", status: "sending" },
    ]);

    try {
      const reply = await fetchListReply();
      const isError = reply.startsWith("התהליך לא הצליח");
      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  text: reply,
                  status: isError ? "error" : "ok",
                  ...(isError ? { menuOptions: [BACK_TO_MENU_OPTION], menuDisabled: false } : {}),
                }
              : m,
          ),
        );
      });
      if (isError) activateErrorMenu(pendingId);
      else showFollowUpMenu();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "אין חיבור לרשת";
      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, ...botErrorFields(formatChatFailure(msg)) } : m,
          ),
        );
      });
      activateErrorMenu(pendingId);
    }
  }, [activateErrorMenu, fetchListReply, showFollowUpMenu]);

  const runDeleteStart = useCallback(async () => {
    setFlow({ kind: "delete" });
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: pendingId, role: "bot", text: "…", status: "sending" },
    ]);

    try {
      const listReply = await fetchListReply();
      const isEmpty = isEmptyTransactionListReply(listReply);
      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  text: isEmpty ? listReply : `${listReply}\n\n${CHAT_DELETE_PROMPT}`,
                  status: "ok",
                  menuOptions: [BACK_TO_MENU_OPTION],
                  inlineInput: isEmpty ? undefined : "number",
                  inlinePlaceholder: CHAT_DELETE_PLACEHOLDER,
                }
              : m,
          ),
        );
      });
      setActiveMenuMsgId(pendingId);
      if (isEmpty) {
        setFlow(CHAT_FLOW_IDLE);
      } else {
        activateInline(pendingId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "אין חיבור לרשת";
      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, ...botErrorFields(formatChatFailure(msg)) } : m,
          ),
        );
      });
      activateErrorMenu(pendingId);
    }
  }, [activateErrorMenu, activateInline, fetchListReply, showFollowUpMenu]);

  const runEditStart = useCallback(async () => {
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: pendingId, role: "bot", text: "…", status: "sending" },
    ]);

    try {
      const listReply = await fetchListReply();
      const isEmpty = isEmptyTransactionListReply(listReply);
      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  text: isEmpty ? listReply : `${listReply}\n\n${CHAT_EDIT_PROMPT}`,
                  status: "ok",
                  menuOptions: isEmpty
                    ? [BACK_TO_MENU_OPTION]
                    : [...EDIT_FIELD_MENU_OPTIONS, BACK_TO_MENU_OPTION],
                }
              : m,
          ),
        );
      });
      setActiveMenuMsgId(pendingId);
      setFlow(isEmpty ? CHAT_FLOW_IDLE : { kind: "edit_field" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "אין חיבור לרשת";
      startTransition(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, ...botErrorFields(formatChatFailure(msg)) } : m,
          ),
        );
      });
      activateErrorMenu(pendingId);
    }
  }, [activateErrorMenu, fetchListReply, showFollowUpMenu]);

  const handleMenuPick = useCallback(
    async (option: MenuOption) => {
      if (busy) return;
      disableActiveMenus();
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", text: option.label, status: "ok" },
      ]);

      if (option.id === "back_menu") {
        setFlow(CHAT_FLOW_IDLE);
        disableActiveInlines();
        showFollowUpMenu();
        return;
      }

      if (option.id === "add") {
        const msgId = uid();
        setFlow({ kind: "add" });
        appendBotMessage({
          id: msgId,
          text: CHAT_ADD_PROMPT,
          status: "ok",
          menuOptions: [BACK_TO_MENU_OPTION],
          inlineInput: "expense",
          inlinePlaceholder: CHAT_ADD_PLACEHOLDER,
        });
        activateInline(msgId);
        return;
      }

      if (option.id === "list") {
        setFlow(CHAT_FLOW_IDLE);
        disableActiveInlines();
        await runListFromMenu();
        return;
      }

      if (option.id === "delete") {
        disableActiveInlines();
        await runDeleteStart();
        return;
      }

      if (option.id === "edit") {
        disableActiveInlines();
        await runEditStart();
        return;
      }

      const field = menuIdToEditField(option.id);
      if (field && flow.kind === "edit_field") {
        setFlow({ kind: "edit_index", field });
        const msgId = uid();
        appendBotMessage({
          id: msgId,
          text: CHAT_EDIT_INDEX_PROMPT,
          status: "ok",
          menuOptions: [BACK_TO_MENU_OPTION],
          inlineInput: "number",
          inlinePlaceholder: CHAT_EDIT_INDEX_PLACEHOLDER,
        });
        activateInline(msgId);
      }
    },
    [
      activateInline,
      appendBotMessage,
      busy,
      disableActiveInlines,
      disableActiveMenus,
      flow.kind,
      runDeleteStart,
      runEditStart,
      runListFromMenu,
      showFollowUpMenu,
    ],
  );

  const processUserInput = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value || busy) return;
      stickToBottomRef.current = true;

      const appendUser = () => {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "user", text: value, status: "ok" as const },
        ]);
      };

      if (paymentCustomMode && pendingPaymentTxId) {
        await submitPayment(pendingPaymentTxId, value, value);
        return;
      }

      if (pendingEdit) {
        disableActiveInlines();
        appendUser();
        await submitFieldUpdate(pendingEdit, value);
        return;
      }

      if (flow.kind === "delete") {
        disableActiveMenus();
        disableActiveInlines();
        const index = parseTransactionIndex(value);
        if (!index) {
          const errId = appendBotMessage({
            id: uid(),
            text: formatChatFailure("כתוב מספר תנועה תקין, למשל: 1"),
            status: "error",
            menuOptions: [BACK_TO_MENU_OPTION],
          });
          activateErrorMenu(errId);
          return;
        }
        appendUser();
        setFlow(CHAT_FLOW_IDLE);
        await runQuickCommand(`תמחק תנועה מספר ${index}`);
        return;
      }

      if (flow.kind === "edit_index") {
        disableActiveMenus();
        disableActiveInlines();
        const index = parseTransactionIndex(value);
        if (!index) {
          const errId = appendBotMessage({
            id: uid(),
            text: formatChatFailure("כתוב מספר תנועה תקין, למשל: 2"),
            status: "error",
            menuOptions: [BACK_TO_MENU_OPTION],
          });
          activateErrorMenu(errId);
          return;
        }
        const field = flow.field;
        appendUser();
        setFlow(CHAT_FLOW_IDLE);
        await runQuickCommand(editFieldToCommand(field, index), {
          showMenuOnComplete: field !== "payment",
        });
        return;
      }

      if (flow.kind === "add") {
        disableActiveMenus();
        disableActiveInlines();
        appendUser();
        setFlow(CHAT_FLOW_IDLE);
        await sendExpense(value, { skipUserMessage: true });
        return;
      }
    },
    [
      activateErrorMenu,
      appendBotMessage,
      busy,
      disableActiveInlines,
      disableActiveMenus,
      flow,
      pendingEdit,
      paymentCustomMode,
      pendingPaymentTxId,
      runQuickCommand,
      sendExpense,
      submitFieldUpdate,
      submitPayment,
    ],
  );

  const handleInlineSubmit = () => {
    if (!inlineDraft.trim() || busy) return;
    const draft = inlineDraft;
    setInlineDraft("");
    void processUserInput(draft);
  };

  const canConfirmPreset = Boolean(
    selectedPayment && !paymentCustomMode && !isOtherPaymentOption(selectedPayment.id),
  );

  return (
    <div ref={pageRef} className="nf-chat-page">
      <ChatTopBar />

      <div className="nf-chat-thread">
        <div
          ref={listRef}
          className="nf-chat-messages"
          role="log"
          aria-live="polite"
          onScroll={handleMessagesScroll}
        >
          {messages.map((m) => {
            const isActivePayment =
              m.paymentOptions && m.id === activePaymentMsgId && !m.paymentDisabled;
            const isActiveMenu =
              m.menuOptions && m.id === activeMenuMsgId && !m.menuDisabled;
            const isActiveInline =
              m.inlineInput && m.id === activeInlineMsgId && !m.inlineDisabled;

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
                  <span className="nf-bubble-text">{m.text}</span>
                  {m.menuOptions && (
                    <ChatMenuButtons
                      options={m.menuOptions}
                      disabled={busy || !isActiveMenu}
                      onPick={handleMenuPick}
                    />
                  )}
                  {isActiveInline && (
                    <div data-inline-msg={m.id}>
                      <ChatInlineInput
                        value={inlineDraft}
                        placeholder={m.inlinePlaceholder ?? ""}
                        inputMode={m.inlineInput === "number" || m.inlineInput === "date" ? "decimal" : "text"}
                        disabled={busy}
                        onChange={setInlineDraft}
                        onSubmit={handleInlineSubmit}
                        onFocus={() => scrollInlineInputIntoView(m.id, "smooth")}
                      />
                    </div>
                  )}
                  {m.paymentOptions && (
                    <>
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
                      {isActivePayment && paymentCustomMode && (
                        <div data-inline-msg={m.id}>
                          <ChatInlineInput
                            value={inlineDraft}
                            placeholder={CHAT_PAYMENT_OTHER_PROMPT}
                            disabled={busy}
                            onChange={setInlineDraft}
                            onSubmit={handleInlineSubmit}
                            onFocus={() => scrollInlineInputIntoView(m.id, "smooth")}
                          />
                        </div>
                      )}
                      {isActivePayment && (
                        <div className="nf-payment-actions">
                          {paymentCustomMode ? (
                            <button
                              type="button"
                              className="nf-payment-back"
                              disabled={busy}
                              onClick={backToPaymentOptions}
                            >
                              חזרה לבחירה
                            </button>
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
    </div>
  );
}
