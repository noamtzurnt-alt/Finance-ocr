export type ChatPaymentOption = {
  id: string;
  label: string;
  value: string;
};

export const CHAT_PAYMENT_OPTIONS: ChatPaymentOption[] = [
  { id: "7374", label: "7374 - אשראי ראשי", value: "7374" },
  { id: "9304", label: "9304 - אשראי עסקי", value: "9304" },
  { id: "5622", label: "5622 - בהצדעה", value: "5622" },
  { id: "9537", label: "9537 - דיירקט", value: "9537" },
  { id: "paypal", label: "פייפאל", value: "פייפאל" },
  { id: "bit", label: "ביט", value: "ביט" },
  { id: "other", label: "אחר", value: "__other__" },
];

export const CHAT_OTHER_PAYMENT_ID = "other";

export function isOtherPaymentOption(optionId: string) {
  return optionId === CHAT_OTHER_PAYMENT_ID;
}

export function normalizePaymentMethod(raw: string): string | null {
  const value = raw.trim().slice(0, 80);
  return value || null;
}

export function formatPaymentMethodLabel(cardLast4: string | null | undefined): string {
  if (!cardLast4) return "-";
  const known = CHAT_PAYMENT_OPTIONS.find((o) => o.value === cardLast4);
  return known?.label ?? cardLast4;
}
