export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export function gmailOAuthConfig() {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_GMAIL_CLIENT_ID / GOOGLE_GMAIL_CLIENT_SECRET are not configured");
  }

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const redirectUri =
    process.env.GOOGLE_GMAIL_REDIRECT_URI?.trim() ||
    (base ? `${base}/api/auth/gmail/callback` : "");

  if (!redirectUri) {
    throw new Error("Set NEXT_PUBLIC_APP_URL or GOOGLE_GMAIL_REDIRECT_URI for Gmail OAuth");
  }

  return { clientId, clientSecret, redirectUri };
}

export function appBaseUrlFromRequest(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "";
}
