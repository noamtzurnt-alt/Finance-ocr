import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, signSessionToken, verifySessionToken } from "@/app/lib/auth/session";
import { setSessionCookie } from "@/app/lib/auth/cookies";

export const runtime = "nodejs";

const REFRESH_AFTER_SECONDS = 60 * 60 * 24;

/** Session check for the chat shell (no DB). Slides the 30-day expiry while the app is used. */
export async function GET() {
  const secret = process.env.AUTH_SECRET;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const payload = secret && token ? await verifySessionToken(token, secret) : null;
  if (!secret || !payload?.sub || !payload.email) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const iat = typeof (payload as { iat?: unknown }).iat === "number" ? (payload as { iat: number }).iat : 0;
  if (Date.now() / 1000 - iat > REFRESH_AFTER_SECONDS) {
    await setSessionCookie(await signSessionToken({ sub: payload.sub, email: payload.email }, secret));
  }
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
