export type AppTheme = "green" | "pink";

/** Mirrors User.theme so the root layout can render without a DB query. */
export const THEME_COOKIE = "nf_theme";

export const themeCookieOptions = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export function normalizeAppTheme(value: unknown): AppTheme {
  return value === "pink" ? "pink" : "green";
}

export function themeColorMeta(theme: AppTheme): string {
  return theme === "pink" ? "#140810" : "#0b0b0b";
}
