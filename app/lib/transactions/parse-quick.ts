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
  | { type: "unknown"; reason: string };

const CURRENCY_RE = String.raw`₪|ש["״׳']?ח|שקל(?:ים)?|nis|ils|\$|usd|דולר(?:ים)?|€|eur`;

function normalizeAmount(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(/,/g, "");
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

/** Parse quick expense text with optional trailing description. */
export function parseQuickTransactionDetailed(text: string): ParseQuickResult {
  const t = text.trim();
  if (!t) return { ok: false, reason: "לא התקבלה הודעה." };

  // "<vendor> סכום <amount> <currency?> <description?>"
  const m1 = t.match(
    new RegExp(
      String.raw`^(.+?)\s+(?:סכום|amount)\s*[:\-]?\s*(\d+(?:[.,]\d{1,2})?)\s*(${CURRENCY_RE})?\s*(.*)$`,
      "i",
    ),
  );
  // "<vendor> <amount> <currency?> <description?>"
  const m2 = t.match(
    new RegExp(String.raw`^(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*(${CURRENCY_RE})?\s*(.*)$`, "i"),
  );
  const m = m1 ?? m2;
  if (!m) {
    return {
      ok: false,
      reason: "לא הצלחתי להבין את התנועה. כתוב למשל: קוטג 10 שקלים",
    };
  }

  const vendorRaw = (m[1] ?? "").trim();
  const amountRaw = (m[2] ?? "").trim().replace(",", ".");
  const curRaw = (m[3] ?? "").trim();
  const description = cleanDescription(m[4] ?? "");

  if (!vendorRaw) {
    return { ok: false, reason: "חסר שם להוצאה. כתוב למשל: קוטג 10 שקלים" };
  }
  if (!amountRaw) {
    return { ok: false, reason: "חסר סכום. כתוב למשל: קוטג 10 שקלים" };
  }

  const amount = normalizeAmount(amountRaw);
  if (amount === null) {
    return {
      ok: false,
      reason: "הסכום לא תקין. השתמש במספר חיובי עד שתי ספרות אחרי הנקודה, למשל: 10 או 10.50",
    };
  }

  return {
    ok: true,
    tx: {
      vendor: vendorRaw.slice(0, 120),
      amount,
      currency: parseCurrencyToken(curRaw, t),
      description,
    },
  };
}

/** Parse chat command: create expense / delete expense. */
export function parseChatIntent(text: string): ChatIntent {
  const t = text.trim();
  if (!t) return { type: "unknown", reason: "לא התקבלה הודעה." };

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
  return `אין בעיה — הוספתי לתנועות: ${tx.vendor} — ${money} (היום).${suffix}`;
}

export const CHAT_SUCCESS_REPLY = "התהליך הצליח";

export function formatChatFailure(reason: string): string {
  return `התהליך לא הצליח\n${reason}`;
}

export const QUICK_HELP =
  "כתוב לי הוצאה כמו בוואטסאפ:\nקוטג 10 שקלים\nסרט 80\nאו: קפה סכום 12 ₪";

export const CHAT_WELCOME = "היי כאן Noam Finance איזה תנועה תרצה להוסיף?";
