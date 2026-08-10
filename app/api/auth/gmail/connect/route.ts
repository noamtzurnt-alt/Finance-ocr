import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import {
  gmailConnectUrl,
  signGmailOAuthState,
  STATE_COOKIE,
} from "@/app/lib/gmail/oauth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));

  try {
    const state = await signGmailOAuthState(user.id);
    const res = NextResponse.redirect(gmailConnectUrl(state));
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gmail OAuth not configured";
    return NextResponse.redirect(
      new URL(`/settings?gmail_error=${encodeURIComponent(msg)}`, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    );
  }
}
