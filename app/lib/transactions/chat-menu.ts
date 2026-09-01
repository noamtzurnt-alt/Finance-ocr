import type { ChatEditField } from "@/app/lib/transactions/chat-commands";

export type ChatFlow =
  | { kind: "idle" }
  | { kind: "add" }
  | { kind: "delete" }
  | { kind: "edit_field" }
  | { kind: "edit_index"; field: ChatEditField };

export const CHAT_FLOW_IDLE: ChatFlow = { kind: "idle" };

export type InlineInputKind = "expense" | "number" | "text" | "date";

export type MenuOptionId =
  | "add"
  | "list"
  | "delete"
  | "edit"
  | "edit_payment"
  | "edit_description"
  | "edit_vendor"
  | "edit_amount"
  | "edit_date"
  | "back_menu";

export type MenuOption = { id: MenuOptionId; label: string };

export const MAIN_MENU_OPTIONS: MenuOption[] = [
  { id: "add", label: "הוסף תנועה" },
  { id: "list", label: "הצג את כל התנועות" },
  { id: "delete", label: "מחק תנועה" },
  { id: "edit", label: "ערוך תנועה" },
];

export const EDIT_FIELD_MENU_OPTIONS: MenuOption[] = [
  { id: "edit_vendor", label: "שם התנועה" },
  { id: "edit_amount", label: "סכום" },
  { id: "edit_payment", label: "תשלום" },
  { id: "edit_description", label: "תיאור" },
  { id: "edit_date", label: "תאריך" },
];

export const BACK_TO_MENU_OPTION: MenuOption = {
  id: "back_menu",
  label: "חזרה לתפריט",
};

export const CHAT_MENU_FOLLOWUP = "מה תרצה לעשות עכשיו?";
export const CHAT_ADD_PROMPT = "איזו תנועה תרצה להוסיף?";
export const CHAT_ADD_PLACEHOLDER = "לדוגמה: קוטג 10 שקלים";
export const CHAT_DELETE_PROMPT = "כתוב את מספר התנועה שברצונך למחוק:";
export const CHAT_DELETE_PLACEHOLDER = "מספר תנועה";
export const CHAT_EDIT_PROMPT = "מה תרצה לערוך?";
export const CHAT_EDIT_INDEX_PROMPT = "איזו תנועה? כתוב את המספר:";
export const CHAT_EDIT_INDEX_PLACEHOLDER = "מספר תנועה";

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
