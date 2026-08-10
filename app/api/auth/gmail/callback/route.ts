import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { encryptSecret } from "@/app/lib/gmail/crypto";
import {
  exchangeGmailCode,
  fetchGoogleEmail,
  verifyGmailOAuthState,
  STATE_COOKIE,
} from "@/app/lib/gmail/oauth";
import { syncGmailConnection } from "@/app/lib/gmail/sync";
import { appBaseUrlFromRequest } from "@/app/lib/gmail/config";

export const maxDuration = 120;

export async function GET(req: Request) {
  const base = appBaseUrlFromRequest(req) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/settings?gmail_error=${encodeURIComponent(oauthError)}`, base));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?gmail_error=missing_code", base));
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL("/settings?gmail_error=invalid_state", base));
  }

  const verified = await verifyGmailOAuthState(state);
  if (!verified) {
    return NextResponse.redirect(new URL("/settings?gmail_error=expired_state", base));
  }

  try {
    const tokens = await exchangeGmailCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/settings?gmail_error=no_refresh_token", base),
      );
    }

    const emailAddress = await fetchGoogleEmail(tokens.access_token!);
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

    const connection = await prisma.gmailConnection.upsert({
      where: {
        userId_emailAddress: {
          userId: verified.userId,
          emailAddress,
        },
      },
      create: {
        userId: verified.userId,
        emailAddress,
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        accessTokenEnc: encryptSecret(tokens.access_token!),
        accessTokenExpiresAt: expiresAt,
      },
      update: {
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        accessTokenEnc: encryptSecret(tokens.access_token!),
        accessTokenExpiresAt: expiresAt,
        lastError: null,
        syncStatus: "idle",
      },
      select: { id: true },
    });

    try {
      await syncGmailConnection(connection.id);
    } catch (e) {
      console.error("[gmail callback sync]", e);
    }

    return NextResponse.redirect(new URL("/settings?gmail_connected=1", base));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "connect_failed";
    return NextResponse.redirect(new URL(`/settings?gmail_error=${encodeURIComponent(msg)}`, base));
  }
}
