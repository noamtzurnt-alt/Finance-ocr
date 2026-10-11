export type ChatCategoryOption = {
  id: string;
  label: string;
  categoryId?: string;
  value: string;
};

export const CHAT_OTHER_CATEGORY_ID = "other";

export function isOtherCategoryOption(optionId: string) {
  return optionId === CHAT_OTHER_CATEGORY_ID;
}

export function buildChatCategoryOptions(
  categories: { id: string; name: string }[],
): ChatCategoryOption[] {
  return [
    ...categories.map((c) => ({
      id: c.id,
      label: c.name,
      categoryId: c.id,
      value: c.id,
    })),
    { id: CHAT_OTHER_CATEGORY_ID, label: "אחר", value: "__other__" },
  ];
}

export function normalizeCategoryName(raw: string): string | null {
  const value = raw.trim().slice(0, 60);
  return value || null;
}

export type ListedCategory = {
  index: number;
  id: string;
  name: string;
};

export function formatCategoryList(rows: ListedCategory[]): string {
  if (rows.length === 0) {
    return "אין לך קטגוריות עדיין.";
  }
  const lines = rows.map((row) => `${row.index}. ${row.name}`);
  return `הקטגוריות שלך:\n\n${lines.join("\n")}`;
}

export function isEmptyCategoryListReply(reply: string): boolean {
  return /^אין לך קטגוריות/.test(reply.trim());
}

export const CHAT_CATEGORY_ADD_SUCCESS = "הקטגוריה נוספה בהצלחה!";
export const CHAT_CATEGORY_DELETE_SUCCESS = "הקטגוריה נמחקה בהצלחה!";

