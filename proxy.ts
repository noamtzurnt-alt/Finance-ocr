import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/app/lib/auth/session";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/setup",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/setup",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  // Passkey (WebAuthn) login must be reachable before authentication.
  "/api/auth/passkey",
  "/api/health",
  "/api/cron/backup",
  "/api/cron/email-receipts",
  "/api/webhooks/incoming",
  "/api/webhooks/morning",
  "/api/auth/gmail/callback",
];

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/public")) return true;
  if (pathname === "/") return true; // we handle redirect logic in app/page.tsx
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Cron routes must be reachable without login (CRON_SECRET is checked in the route).
  const isCron =
    pathname === "/api/cron/backup" ||
    pathname.startsWith("/api/cron/backup") ||
    pathname === "/api/cron/email-receipts" ||
    pathname.startsWith("/api/cron/email-receipts");
  if (isCron) return NextResponse.next();
  if (isPublicPath(pathname)) return NextResponse.next();

  const loginWithNext = () => {
    const url = new URL("/login", req.url);
    const next = `${pathname}${req.nextUrl.search}`;
    if (next && next !== "/login") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return loginWithNext();

  const secret = process.env.AUTH_SECRET;
  if (!secret) return loginWithNext();

  const payload = await verifySessionToken(token, secret);
  if (!payload?.sub) return loginWithNext();

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};


