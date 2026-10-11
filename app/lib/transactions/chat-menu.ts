import type { ChatEditField } from "@/app/lib/transactions/chat-commands";

export type ChatFlow =
  | { kind: "idle" }
  | { kind: "add" }
  | { kind: "delete" }
  | { kind: "edit_field" }
  | { kind: "edit_index"; field: ChatEditField }
  | { kind: "edit_pick" }
  | { kind: "add_category" }
  | { kind: "delete_category" };

export const CHAT_FLOW_IDLE: ChatFlow = { kind: "idle" };

export type InlineInputKind = "expense" | "number" | "text" | "date";

export type MenuOptionId =
  | "add"
  | "list"
  | "list_categories"
  | "budget_plan"
  | "delete"
  | "edit"
  | "add_category"
  | "delete_category"
  | "edit_payment"
  | "edit_description"
  | "edit_vendor"
  | "edit_amount"
  | "edit_date"
  | "ask_date"
  | "back_menu";

export type MenuOption = { id: MenuOptionId; label: string };

export const BACK_TO_MENU_OPTION: MenuOption = {
  id: "back_menu",
  label: "חזרה לתפריט",
};

export const ASK_DATE_OPTION: MenuOption = {
  id: "ask_date",
  label: "תאריך?",
};

export const ADD_TX_MENU_OPTIONS: MenuOption[] = [ASK_DATE_OPTION, BACK_TO_MENU_OPTION];

/** Opening / follow-up menu only */
export const MAIN_MENU_OPTIONS: MenuOption[] = [
  { id: "add", label: "הוסף תנועה חדשה" },
  { id: "list", label: "תנועות החודש" },
  { id: "list_categories", label: "הצג את כל הקטגוריות" },
  { id: "budget_plan", label: "תקציב ועמידה ביעדים" },
];

/** Shown under the transaction list */
export const LIST_TX_MENU_OPTIONS: MenuOption[] = [
  { id: "delete", label: "מחק תנועה" },
  { id: "edit", label: "ערוך תנועה" },
  { id: "back_menu", label: "חזרה לתפריט" },
];

/** Shown under the category list */
export const LIST_CATEGORY_MENU_OPTIONS: MenuOption[] = [
  { id: "add_category", label: "הוסף קטגוריה" },
  { id: "delete_category", label: "מחק קטגוריה" },
  { id: "back_menu", label: "חזרה לתפריט" },
];

export const EDIT_FIELD_MENU_OPTIONS: MenuOption[] = [
  { id: "edit_vendor", label: "שם התנועה" },
  { id: "edit_amount", label: "סכום" },
  { id: "edit_payment", label: "תשלום" },
  { id: "edit_description", label: "תיאור" },
  { id: "edit_date", label: "תאריך" },
];

export const CHAT_MENU_FOLLOWUP = "מה תרצה לעשות עכשיו?";
export const CHAT_ADD_PROMPT = "כתוב: שם, סכום, ואז תיאור (אופציונלי)";
export const CHAT_ADD_PLACEHOLDER = "";

export function chatAddPromptWithDate(dateYmd: string | null): string {
  if (!dateYmd) return CHAT_ADD_PROMPT;
  const [y, m, d] = dateYmd.split("-");
  const label = d && m && y ? `${d}/${m}/${y}` : dateYmd;
  return `${CHAT_ADD_PROMPT}\nתאריך נבחר: ${label}`;
}

export const CHAT_DELETE_PROMPT = "כתוב את מספר התנועה שברצונך למחוק:";
export const CHAT_DELETE_PLACEHOLDER = "מספר תנועה";
export const CHAT_EDIT_PROMPT = "מה תרצה לערוך?";
export const CHAT_EDIT_INDEX_PROMPT = "איזו תנועה? כתוב את המספר, או לחץ עליה:";
export const CHAT_EDIT_INDEX_PLACEHOLDER = "מספר תנועה";
export const CHAT_ADD_CATEGORY_PROMPT = "מה שם הקטגוריה החדשה?";
export const CHAT_ADD_CATEGORY_PLACEHOLDER = "";
export const CHAT_DELETE_CATEGORY_PROMPT = "כתוב את מספר הקטגוריה שברצונך למחוק:";
export const CHAT_DELETE_CATEGORY_PLACEHOLDER = "מספר קטגוריה";

export function menuIdToEditField(id: MenuOptionId): ChatEditField | null {
  if (id === "edit_payment") return "payment";
  if (id === "edit_description") return "description";
  if (id === "edit_vendor") return "vendor";
  if (id === "edit_amount") return "amount";
  if (id === "edit_date") return "date";
  return null;
}

export function editFieldToCommand(field: ChatEditField, index: number): string {
  if (field === "payment") return `שנה אמצעי תשלום בתנועה ${index}`;
  if (field === "description") return `שנה תיאור בתנועה ${index}`;
  if (field === "vendor") return `שנה כותרת בתנועה ${index}`;
  if (field === "date") return `שנה תאריך בתנועה ${index}`;
  return `שנה סכום בתנועה ${index}`;
}

export function inlinePlaceholderForEditField(field: Exclude<ChatEditField, "payment">): string {
  if (field === "vendor") return "שם התנועה";
  if (field === "amount") return "סכום חדש";
  if (field === "date") return "לדוגמה: 15/9/2026";
  return "תיאור חדש";
}

export function inlineInputKindForEditField(
  field: Exclude<ChatEditField, "payment">,
): InlineInputKind {
  if (field === "amount") return "number";
  if (field === "date") return "date";
  return "text";
}
