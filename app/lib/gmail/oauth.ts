import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { encryptSecret, decryptSecret } from "./crypto";
import { gmailOAuthConfig, GMAIL_READONLY_SCOPE, GMAIL_USERINFO_EMAIL_SCOPE } from "./config";
import { prisma } from "@/app/lib/prisma";

const STATE_COOKIE = "gmail_oauth_state";
const STATE_TTL_SEC = 600;

function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signGmailOAuthState(userId: string) {
  const nonce = crypto.randomUUID();
  return new SignJWT({ sub: userId, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${STATE_TTL_SEC}s`)
    .sign(authSecret());
}

export async function verifyGmailOAuthState(token: string) {
  const { payload } = await jwtVerify(token, authSecret());
  if (!payload.sub || typeof payload.sub !== "string") return null;
  return { userId: payload.sub };
}

export function gmailConnectUrl(state: string) {
  const { clientId, redirectUri } = gmailOAuthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `${GMAIL_READONLY_SCOPE} ${GMAIL_USERINFO_EMAIL_SCOPE}`);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGmailCode(code: string) {
  const { clientId, clientSecret, redirectUri } = gmailOAuthConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "OAuth token exchange failed");
  }
  return data;
}

export async function refreshGmailAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = gmailOAuthConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token refresh failed");
  }
  return data;
}

export async function fetchGoogleEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as { email?: string };
  if (!res.ok || !data.email) throw new Error("Failed to read Gmail account email");
  return data.email;
}

export async function getGmailAccessToken(connectionId: string) {
  const conn = await prisma.gmailConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      refreshTokenEnc: true,
      accessTokenEnc: true,
      accessTokenExpiresAt: true,
    },
  });
  if (!conn) throw new Error("Gmail connection not found");

  const now = Date.now();
  if (
    conn.accessTokenEnc &&
    conn.accessTokenExpiresAt &&
    conn.accessTokenExpiresAt.getTime() > now + 60_000
  ) {
    return decryptSecret(conn.accessTokenEnc);
  }

  const refreshToken = decryptSecret(conn.refreshTokenEnc);
  const tokens = await refreshGmailAccessToken(refreshToken);
  const expiresAt = new Date(now + (tokens.expires_in ?? 3600) * 1000);

  await prisma.gmailConnection.update({
    where: { id: connectionId },
    data: {
      accessTokenEnc: encryptSecret(tokens.access_token!),
      accessTokenExpiresAt: expiresAt,
    },
  });

  return tokens.access_token!;
}

export { STATE_COOKIE };
