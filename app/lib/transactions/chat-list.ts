import { formatPaymentMethodLabel } from "@/app/lib/transactions/chat-payment";

export const CHAT_LIST_LIMIT = 30;

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export type ListedTransaction = {
  index: number;
  id: string;
  vendor: string;
  amount: string;
  currency: string;
  description: string | null;
  paymentMethod: string | null;
  date: string;
};

export function getCurrentMonthRange(refDate = new Date()) {
  const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
  return { start, end };
}

export function formatCurrentMonthLabel(refDate = new Date()): string {
  return `${HEBREW_MONTHS[refDate.getMonth()]} ${refDate.getFullYear()}`;
}

function money(amount: string, currency: string) {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₪";
  return `${Number(amount).toFixed(2)} ${sym}`;
}

export function isEmptyTransactionListReply(reply: string): boolean {
  return /^אין לך תנועות ב/.test(reply.trim());
}

export function formatTransactionList(rows: ListedTransaction[], refDate = new Date()): string {
  const monthLabel = formatCurrentMonthLabel(refDate);
  if (rows.length === 0) {
    return `אין לך תנועות ב${monthLabel}.`;
  }

  const lines = rows.map((row) => {
    const parts = [
      `${row.index}. ${row.vendor}, ${money(row.amount, row.currency)}`,
      row.paymentMethod ? `תשלום: ${formatPaymentMethodLabel(row.paymentMethod)}` : null,
      row.description ? `תיאור: ${row.description}` : null,
      `תאריך: ${row.date}`,
    ].filter(Boolean);
    return parts.join("\n   ");
  });

  return `התנועות שלך ל${monthLabel}:\n\n${lines.join("\n\n")}`;
}

export function formatTransactionLine(row: ListedTransaction): string {
  return `${row.index}. ${row.vendor}, ${money(row.amount, row.currency)}`;
}
