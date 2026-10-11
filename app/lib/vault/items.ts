export type VaultFieldKind = "text" | "email" | "secret" | "url" | "multiline";

export type VaultField = {
  id: string;
  label: string;
  value: string;
  kind: VaultFieldKind;
};

export type VaultItemType = "login" | "card" | "note" | "other";

/** Decrypted item payload (version 1). */
export type VaultItemData = {
  v: 1;
  type: VaultItemType;
  title: string;
  favorite?: boolean;
  fields: VaultField[];
};

export const ITEM_TYPE_LABELS: Record<VaultItemType, string> = {
  login: "התחברות",
  card: "כרטיס אשראי",
  note: "פתק מאובטח",
  other: "אחר",
};

export const FIELD_KIND_LABELS: Record<VaultFieldKind, string> = {
  text: "טקסט",
  email: "אימייל",
  secret: "סיסמה / סודי",
  url: "קישור",
  multiline: "טקסט ארוך",
};

function fid() {
  return `f_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function newField(kind: VaultFieldKind, label = ""): VaultField {
  return { id: fid(), label, value: "", kind };
}

export function templateFor(type: VaultItemType): VaultItemData {
  const fields: VaultField[] =
    type === "login"
      ? [
          newField("email", "שם משתמש / אימייל"),
          newField("secret", "סיסמה"),
          newField("url", "אתר"),
          newField("multiline", "הערות"),
        ]
      : type === "card"
        ? [
            newField("text", "שם בעל הכרטיס"),
            newField("secret", "מספר כרטיס"),
            newField("text", "תוקף"),
            newField("secret", "CVV"),
            newField("multiline", "הערות"),
          ]
        : type === "note"
          ? [newField("multiline", "תוכן")]
          : [newField("text", ""), newField("secret", "")];
  return { v: 1, type, title: "", fields };
}

/** Line under the title in the list (never a secret). */
export function itemSubtitle(item: VaultItemData): string {
  const first = item.fields.find((f) => f.value.trim() && f.kind !== "secret" && f.kind !== "multiline");
  if (first) return first.value.trim();
  return ITEM_TYPE_LABELS[item.type];
}

/** Last opened folder ("all" or a folder id), so /vault reopens where the user left off. */
export const VAULT_SCOPE_COOKIE = "nf_vault_scope";
