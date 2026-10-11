import { formatPaymentMethodLabel } from "@/app/lib/transactions/chat-payment";

/** Align with transactions page month view (see getTransactionsList). */
export const CHAT_LIST_LIMIT = 200;

export type ListedTransaction = {
  index: number;
  id: string;
  vendor: string;
  amount: string;
  currency: string;
  description: string | null;
  paymentMethod: string | null;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
};

function money(amount: string, currency: string) {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₪";
  return `${Number(amount).toFixed(2)} ${sym}`;
}

export function isEmptyTransactionListReply(reply: string): boolean {
  return /^אין לך תנועות ב/.test(reply.trim());
}

export function formatTransactionList(rows: ListedTransaction[], monthLabel: string): string {
  if (rows.length === 0) {
    return `אין לך תנועות ב${monthLabel}.`;
  }

  const lines = rows.map((row) => {
    const pay = row.paymentMethod ? formatPaymentMethodLabel(row.paymentMethod) : "ללא תשלום";
    const desc = row.description ? ` · ${row.description}` : "";
    return `${row.index}. ${row.vendor}${desc}\n   ${money(row.amount, row.currency)} · ${pay} · ${row.date}`;
  });

  return `התנועות שלך ל${monthLabel} (${rows.length}):\n\n${lines.join("\n\n")}`;
}

export function formatTransactionLine(row: ListedTransaction): string {
  return `${row.index}. ${row.vendor}, ${money(row.amount, row.currency)}`;
}
