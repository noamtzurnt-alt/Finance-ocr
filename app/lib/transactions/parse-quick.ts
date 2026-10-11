import {
  parseDeleteByIndexIntent,
  parseEditByIndexIntent,
  parseListIntent,
  type ChatEditField,
} from "@/app/lib/transactions/chat-commands";

export type QuickCurrency = "ILS" | "USD" | "EUR";

export type QuickTransaction = {
  vendor: string;
  amount: number;
  currency: QuickCurrency;
  description: string | null;
};

export type ParseQuickResult =
  | { ok: true; tx: QuickTransaction }
  | { ok: false; reason: string };

export type ChatIntent =
  | { type: "create"; tx: QuickTransaction }
  | { type: "delete"; vendor: string; amount: number | null; currency: QuickCurrency | null }
  | { type: "deleteByIndex"; index: number }
  | { type: "list" }
  | { type: "editByIndex"; index: number; field: ChatEditField }
  | { type: "unknown"; reason: string };

const CURRENCY_RE = String.raw`₪|ש["״׳']?ח|שקל(?:ים)?|nis|ils|\$|usd|דולר(?:ים)?|€|eur`;
const AMOUNT_TOKEN_RE = /^(\d+(?:[.,]\d{1,2})?)(?:(₪|\$|€|usd|eur|nis|ils|ש["״׳']?ח|שקל(?:ים)?|דולר(?:ים)?))?$/i;
const CURRENCY_ONLY_RE = new RegExp(String.raw`^(?:${CURRENCY_RE})$`, "i");

function normalizeQuickText(text: string): string {
  return text
    .normalize("NFKC")
    // Eastern Arabic / Persian digits → ASCII
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u00A0\u202F\u2007\u2060\u200B\u200E\u200F\u202A-\u202E]/g, " ")
    .replace(/[٫٬]/g, ".")
    .replace(/[．。]/g, ".")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAmount(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return n;
}

function currencySymbol(currency: QuickCurrency): string {
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  return "₪";
}

function parseCurrencyToken(curRaw: string | undefined, fullText: string): QuickCurrency {
  const cur = (curRaw ?? "").trim().toLowerCase();
  let currency: QuickCurrency = "ILS";
  if (cur.includes("$") || cur.includes("usd") || cur.includes("דולר")) currency = "USD";
  if (cur.includes("€") || cur.includes("eur")) currency = "EUR";
  if (
    cur.includes("₪") ||
    cur.includes("שח") ||
    cur.includes('ש"ח') ||
    cur.includes("שקל") ||
    cur.includes("nis") ||
    cur.includes("ils")
  ) {
    currency = "ILS";
  }
  if (!cur) {
    const hasHebrew = /[\u0590-\u05FF]/.test(fullText);
    const hasLatin = /[a-z]/i.test(fullText);
    if (!hasHebrew && hasLatin) currency = "USD";
  }
  return currency;
}

function cleanDescription(raw: string): string | null {
  const d = raw.replace(/\s+/g, " ").trim();
  if (!d) return null;
  return d.slice(0, 200);
}

/**
 * Parse quick expense text.
 * Fixed order: <name> <amount> [currency] [description...]
 * Examples: "apple 11.90 אחסון חודשי" | "קוטג 10 שקלים" | "סרט 80"
 */
export function parseQuickTransactionDetailed(text: string): ParseQuickResult {
  const t = normalizeQuickText(text);
  if (!t) return { ok: false, reason: "לא התקבלה הודעה." };

  // Alternate form: "<name> סכום <amount> [currency] [description]"
  const withAmountWord = t.match(
    new RegExp(
      String.raw`^(.+?)\s+(?:סכום|amount)\s*[:\-]?\s*(\d+(?:[.,]\d{1,2})?)\s*(${CURRENCY_RE})?\s*(.*)$`,
      "i",
    ),
  );

  let nameRaw = "";
  let amountRaw = "";
  let curRaw = "";
  let descriptionRaw = "";

  if (withAmountWord) {
    nameRaw = (withAmountWord[1] ?? "").trim();
    amountRaw = (withAmountWord[2] ?? "").trim();
    curRaw = (withAmountWord[3] ?? "").trim();
    descriptionRaw = withAmountWord[4] ?? "";
  } else {
    const tokens = t.split(" ").filter(Boolean);

    // Allow glued name+amount as first token: "apple11.90"
    const gluedFirst = tokens[0]?.match(
      /^([A-Za-z\u0590-\u05FF][A-Za-z\u0590-\u05FF'’\-]*)(\d+(?:[.,]\d{1,2})?)(₪|\$|€|usd|eur|nis|ils)?$/i,
    );

    let amountIdx = -1;
    let amountMatch: RegExpMatchArray | null = null;

    if (gluedFirst) {
      nameRaw = (gluedFirst[1] ?? "").trim();
      amountRaw = (gluedFirst[2] ?? "").trim();
      curRaw = (gluedFirst[3] ?? "").trim();
      amountIdx = 0;
    } else {
      // Find the amount: first token that is a price (name must come before it)
      for (let i = 0; i < tokens.length; i++) {
        const m = tokens[i]?.match(AMOUNT_TOKEN_RE);
        if (m) {
          amountIdx = i;
          amountMatch = m;
          break;
        }
      }
      if (amountIdx < 0 || !amountMatch) {
        return {
          ok: false,
          reason: "כתוב בסדר: שם, סכום, ואז תיאור. למשל: apple 11.90 אחסון חודשי",
        };
      }
      if (amountIdx === 0) {
        return {
          ok: false,
          reason: "חסר שם התנועה לפני הסכום. למשל: apple 11.90 אחסון חודשי",
        };
      }
      nameRaw = tokens.slice(0, amountIdx).join(" ").trim();
      amountRaw = (amountMatch[1] ?? "").trim();
      curRaw = (amountMatch[2] ?? "").trim();
    }

    // After amount: optional currency, then description
    const after = tokens.slice(amountIdx + 1);
    if (after[0] && CURRENCY_ONLY_RE.test(after[0]) && !curRaw) {
      curRaw = after[0];
      descriptionRaw = after.slice(1).join(" ");
    } else {
      descriptionRaw = after.join(" ");
    }
  }

  nameRaw = nameRaw.replace(/\s+/g, " ").trim();
  amountRaw = amountRaw.replace(",", ".");
  const description = cleanDescription(descriptionRaw);

  if (!nameRaw) {
    return {
      ok: false,
      reason: "חסר שם התנועה. כתוב למשל: apple 11.90 אחסון חודשי",
    };
  }
  if (!amountRaw) {
    return {
      ok: false,
      reason: "חסר סכום אחרי השם. כתוב למשל: apple 11.90 אחסון חודשי",
    };
  }

  const amount = normalizeAmount(amountRaw);
  if (amount === null) {
    return {
      ok: false,
      reason: "הסכום לא תקין. למשל: 10 או 11.90",
    };
  }

  return {
    ok: true,
    tx: {
      vendor: nameRaw.slice(0, 120),
      amount,
      currency: parseCurrencyToken(curRaw, t),
      description,
    },
  };
}

/** Parse chat command: create / list / edit / delete expense. */
export function parseChatIntent(text: string): ChatIntent {
  const t = text.trim();
  if (!t) return { type: "unknown", reason: "לא התקבלה הודעה." };

  if (parseListIntent(t)) {
    return { type: "list" };
  }

  const edit = parseEditByIndexIntent(t);
  if (edit) {
    return { type: "editByIndex", index: edit.index, field: edit.field };
  }

  const deleteIndex = parseDeleteByIndexIntent(t);
  if (deleteIndex != null) {
    return { type: "deleteByIndex", index: deleteIndex };
  }

  const deleteMatch = t.match(
    /^(?:ת)?מחק(?:י)?(?:\s+לי)?(?:\s+את)?(?:\s+ה)?(?:\s+תנועה)?\s*(.+)$/iu,
  );
  if (deleteMatch?.[1]) {
    const rest = deleteMatch[1].trim();
    const withAmount = rest.match(
      new RegExp(String.raw`^(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*(${CURRENCY_RE})?\s*$`, "i"),
    );
    if (withAmount) {
      const amount = normalizeAmount((withAmount[2] ?? "").replace(",", "."));
      if (amount === null) {
        return { type: "unknown", reason: "הסכום למחיקה לא תקין." };
      }
      return {
        type: "delete",
        vendor: withAmount[1].trim().slice(0, 120),
        amount,
        currency: parseCurrencyToken(withAmount[3], rest),
      };
    }
    if (!rest) {
      return { type: "unknown", reason: "כתוב מה למחוק, למשל: תמחק סרט 100" };
    }
    return { type: "delete", vendor: rest.slice(0, 120), amount: null, currency: null };
  }

  const created = parseQuickTransactionDetailed(t);
  if (!created.ok) return { type: "unknown", reason: created.reason };
  return { type: "create", tx: created.tx };
}

/** Parse quick expense text: "קוטג 10 שקלים" / "סרט 80" / "coffee 12". */
export function parseQuickTransaction(text: string): Omit<QuickTransaction, "description"> | null {
  const result = parseQuickTransactionDetailed(text);
  if (!result.ok) return null;
  const { vendor, amount, currency } = result.tx;
  return { vendor, amount, currency };
}

export function formatQuickReply(tx: Omit<QuickTransaction, "description"> & { description?: string | null }, id?: string): string {
  const money = `${tx.amount.toFixed(2)} ${currencySymbol(tx.currency)}`;
  const suffix = id ? `\nמזהה: ${id.slice(0, 8)}` : "";
  return `אין בעיה, הוספתי לתנועות: ${tx.vendor}, ${money} (היום).${suffix}`;
}

export const CHAT_SUCCESS_REPLY = "התהליך הצליח";
export const CHAT_PARSE_FAILURE = "לא הצלחתי לקלוט את התנועה";
export const CHAT_PAYMENT_PROMPT = "מעולה, מהם אמצעי התשלום?";
export const CHAT_PAYMENT_OTHER_PROMPT = "הקלד את אמצעי התשלום";
export const CHAT_PAYMENT_SUCCESS = "עודכן בהצלחה!";
export const CHAT_CATEGORY_PROMPT = "באיזו קטגוריה לשייך את התנועה?";
export const CHAT_CATEGORY_OTHER_PROMPT = "הקלד שם קטגוריה חדשה";
export const CHAT_CATEGORY_SUCCESS = "נוסף בהצלחה!";
export const CHAT_PAYMENT_FAILURE = "לא עודכן";
export const CHAT_CATEGORY_FAILURE = "לא עודכן";

export function formatChatFailure(reason: string): string {
  return `התהליך לא הצליח\n${reason}`;
}

export function formatChatParseFailure(reason: string): string {
  return `${CHAT_PARSE_FAILURE}\n${reason}`;
}

export function formatChatPaymentFailure(reason: string): string {
  return `${CHAT_PAYMENT_FAILURE}\n${reason}`;
}

export function formatChatCategoryFailure(reason: string): string {
  return `${CHAT_CATEGORY_FAILURE}\n${reason}`;
}

export const QUICK_HELP =
  "כתוב בסדר: שם, סכום, תיאור\nלמשל: apple 11.90 אחסון חודשי\nאו: קוטג 10 שקלים";

export const CHAT_WELCOME = "היי, מה תרצה לעשות היום?";
