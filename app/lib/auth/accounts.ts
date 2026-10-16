export const ALLOWED_ACCOUNT_EMAILS = ["noamtzurt@gmail.com"] as const;

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

export function displayNameForEmail(email: string): string {
  if (isNoamEmail(email)) return "Noam";
  const local = normalizeEmail(email).split("@")[0] ?? "משתמש";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function showBusinessNavForEmail(email: string): boolean {
  return isNoamEmail(email);
}

export function defaultThemeForEmail(_email: string): "green" | "pink" {
  return "green";
}

export function chatLabelForEmail(_email: string): string {
  return "Noam Finance";
}
