export type ChatEditField = "payment" | "description" | "vendor" | "amount" | "date";

const INDEX_RE = /(?:מספר\s*)?#?(\d+)/i;

export function parseTransactionIndex(text: string): number | null {
  const m = text.match(INDEX_RE);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1 || n > 999) return null;
  return n;
}

export function parseListIntent(text: string): boolean {
  const t = text.trim();
  return /^(?:הצג|תציג|תראה|הראה)(?:\s+לי)?(?:\s+את)?(?:\s+ה)?(?:\s+כל)?\s*(?:ה)?תנועות(?:\s+שלי)?\s*[!.?]*$/iu.test(
    t,
  );
}

export function parseDeleteByIndexIntent(text: string): number | null {
  const t = text.trim();
  const m = t.match(
    /^(?:ת)?מחק(?:י)?(?:\s+לי)?(?:\s+את)?(?:\s+ה)?\s*תנועה(?:\s+מספר|\s+מס׳|\s+#)?\s*(\d+)\s*[!.?]*$/iu,
  );
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

const EDIT_FIELD_PATTERNS: { field: ChatEditField; re: RegExp }[] = [
  {
    field: "payment",
    re: /^(?:שנה|עדכן|תעדכן|תשנה)(?:\s+לי)?\s+(?:את\s+)?(?:ה)?אמצעי(?:\s+ה)?תשלום(?:\s+ב|בתוך|של)?(?:\s+ה)?\s*תנועה(?:\s+מספר|\s+מס׳|\s+#)?\s*(\d+)\s*[!.?]*$/iu,
  },
  {
    field: "description",
    re: /^(?:שנה|עדכן|תעדכן|תשנה)(?:\s+לי)?\s+(?:את\s+)?(?:ה)?תיאור(?:\s+ב|בתוך|של)?(?:\s+ה)?\s*תנועה(?:\s+מספר|\s+מס׳|\s+#)?\s*(\d+)\s*[!.?]*$/iu,
  },
  {
    field: "vendor",
    re: /^(?:שנה|עדכן|תעדכן|תשנה)(?:\s+לי)?\s+(?:את\s+)?(?:ה)?(?:כותרת|שם(?:\s+התנועה)?|בית\s+עסק)(?:\s+ב|בתוך|של)?(?:\s+ה)?\s*תנועה(?:\s+מספר|\s+מס׳|\s+#)?\s*(\d+)\s*[!.?]*$/iu,
  },
  {
    field: "amount",
    re: /^(?:שנה|עדכן|תעדכן|תשנה)(?:\s+לי)?\s+(?:את\s+)?(?:ה)?(?:מחיר|סכום)(?:\s+ב|בתוך|של)?(?:\s+ה)?\s*תנועה(?:\s+מספר|\s+מס׳|\s+#)?\s*(\d+)\s*[!.?]*$/iu,
  },
  {
    field: "date",
    re: /^(?:שנה|עדכן|תעדכן|תשנה)(?:\s+לי)?\s+(?:את\s+)?(?:ה)?תאריך(?:\s+ב|בתוך|של)?(?:\s+ה)?\s*תנועה(?:\s+מספר|\s+מס׳|\s+#)?\s*(\d+)\s*[!.?]*$/iu,
  },
];

export function parseEditByIndexIntent(
  text: string,
): { index: number; field: ChatEditField } | null {
  const t = text.trim();
  for (const { field, re } of EDIT_FIELD_PATTERNS) {
    const m = t.match(re);
    if (!m?.[1]) continue;
    const index = Number(m[1]);
    if (!Number.isInteger(index) || index < 1) continue;
    return { index, field };
  }
  return null;
}

export function editPrompt(field: ChatEditField, index: number): string {
  if (field === "payment") return `אוקיי, למה לשנות את אמצעי התשלום בתנועה ${index}?`;
  if (field === "description") return `מה התיאור החדש לתנועה ${index}?`;
  if (field === "vendor") return `מה שם התנועה החדש לתנועה ${index}?`;
  if (field === "date") return `מה התאריך החדש לתנועה ${index}?\nלדוגמה: 15/9/2026`;
  return `מה הסכום החדש לתנועה ${index}?`;
}

export const CHAT_DELETE_BY_INDEX_SUCCESS = "התנועה נמחקה בהצלחה!";
export const CHAT_UPDATE_FIELD_SUCCESS = "עודכן בהצלחה!";
