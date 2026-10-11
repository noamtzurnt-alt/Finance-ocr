export const ALLOWED_ACCOUNT_EMAILS = [
  "noamtzurt@gmail.com",
  "meitar672@gmail.com",
] as const;

export type AllowedAccountEmail = (typeof ALLOWED_ACCOUNT_EMAILS)[number];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedAccountEmail(email: string): email is AllowedAccountEmail {
  return (ALLOWED_ACCOUNT_EMAILS as readonly string[]).includes(normalizeEmail(email));
}

export function isNoamEmail(email: string): boolean {
  return normalizeEmail(email) === "noamtzurt@gmail.com";
}

export function isMeitarEmail(email: string): boolean {
  return normalizeEmail(email) === "meitar672@gmail.com";
}

export function displayNameForEmail(email: string): string {
  if (isMeitarEmail(email)) return "Meitar";
  if (isNoamEmail(email)) return "Noam";
  const local = normalizeEmail(email).split("@")[0] ?? "משתמש";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function showBusinessNavForEmail(email: string): boolean {
  return isNoamEmail(email);
}

export function defaultThemeForEmail(email: string): "green" | "pink" {
  return isMeitarEmail(email) ? "pink" : "green";
}

export function chatLabelForEmail(email: string): string {
  return isMeitarEmail(email) ? "Meitar Finance" : "Noam Finance";
}
