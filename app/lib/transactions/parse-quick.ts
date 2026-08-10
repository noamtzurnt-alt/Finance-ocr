export type QuickCurrency = "ILS" | "USD" | "EUR";

export type QuickTransaction = {
  vendor: string;
  amount: number;
  currency: QuickCurrency;
};

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

/** Parse quick expense text: "קוטג 10 שקלים" / "סרט 80" / "coffee 12". */
export function parseQuickTransaction(text: string): QuickTransaction | null {
  const t = text.trim();
  if (!t) return null;

  // Pattern A: "<vendor> סכום <amount> <currency?>"
  const m1 = t.match(
    /^(.+?)\s+(?:סכום|amount)\s*[:\-]?\s*(\d+(?:[.,]\d{1,2})?)\s*(₪|ש["״׳']?ח|שקל(?:ים)?|nis|ils|\$|usd|דולר(?:ים)?|€|eur)?\s*$/i,
  );
  // Pattern B: "<vendor> <amount> <currency?>"
  const m2 = t.match(/^(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*(₪|ש["״׳']?ח|שקל(?:ים)?|nis|ils|\$|usd|דולר(?:ים)?|€|eur)?\s*$/i);
  const m = m1 ?? m2;
  const vendorRaw = (m?.[1] ?? "").trim();
  const amountRaw = (m?.[2] ?? "").trim().replace(",", ".");
  const curRaw = (m?.[3] ?? "").trim().toLowerCase();
  if (!vendorRaw || !amountRaw) return null;

  const amount = normalizeAmount(amountRaw);
  if (amount === null) return null;

  let currency: QuickCurrency = "ILS";
  if (curRaw.includes("$") || curRaw.includes("usd") || curRaw.includes("דולר")) currency = "USD";
  if (curRaw.includes("€") || curRaw.includes("eur")) currency = "EUR";
  if (
    curRaw.includes("₪") ||
    curRaw.includes("שח") ||
    curRaw.includes('ש"ח') ||
    curRaw.includes("שקל") ||
    curRaw.includes("nis") ||
    curRaw.includes("ils")
  ) {
    currency = "ILS";
  }

  // If no explicit currency but message is mostly English, assume USD.
  if (!curRaw) {
    const hasHebrew = /[\u0590-\u05FF]/.test(t);
    const hasLatin = /[a-z]/i.test(t);
    if (!hasHebrew && hasLatin) currency = "USD";
  }

  return { vendor: vendorRaw.slice(0, 120), amount, currency };
}

export function formatQuickReply(tx: QuickTransaction, id?: string): string {
  const money = `${tx.amount.toFixed(2)} ${currencySymbol(tx.currency)}`;
  const suffix = id ? `\nמזהה: ${id.slice(0, 8)}` : "";
  return `אין בעיה — הוספתי לתנועות: ${tx.vendor} — ${money} (היום).${suffix}`;
}

export const QUICK_HELP =
  "כתוב לי הוצאה כמו בוואטסאפ:\nקוטג 10 שקלים\nסרט 80\nאו: קפה סכום 12 ₪";
