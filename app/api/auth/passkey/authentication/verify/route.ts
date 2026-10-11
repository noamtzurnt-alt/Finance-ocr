import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { prisma } from "@/app/lib/prisma";
import { getWebAuthnHost } from "@/app/lib/auth/webauthn";
import { cookies } from "next/headers";
import { signSessionToken } from "@/app/lib/auth/session";
import { setSessionCookie } from "@/app/lib/auth/cookies";
import { isValidSignedChallenge } from "@/app/lib/auth/passkey-challenge";
import { normalizeAppTheme, THEME_COOKIE, themeCookieOptions } from "@/app/lib/ui/theme";

export const runtime = "nodejs";

/** Warm-up: called while the Face ID sheet is open so POST doesn't pay the cold start. */
export async function GET() {
  await prisma.$queryRaw`SELECT 1`.catch(() => null);
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}

const bodySchema = z.object({
  response: z.any(),
  expectUserId: z.string().uuid().optional().nullable(),
});

function decodeId(s: string): Uint8Array<ArrayBuffer> | null {
  const v = (s ?? "").trim();
  if (!v) return null;
  try {
    const b = Buffer.from(v, "base64url");
    const out: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(b.length));
    out.set(b);
    return out;
  } catch {
    // Some browsers/flows may still use standard base64
    try {
      const b = Buffer.from(v, "base64");
      const out: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(b.length));
      out.set(b);
      return out;
    } catch {
      return null;
    }
  }
}

export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "AUTH_SECRET is missing" }, { status: 500 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const cs = await cookies();
  const cookieChallenge = cs.get("webauthn_auth_challenge")?.value ?? "";
  const expectedChallenge = (c: string) =>
    (cookieChallenge !== "" && c === cookieChallenge) || isValidSignedChallenge(c, secret);

  const { rpID, origin } = await getWebAuthnHost();
  if (!rpID) return NextResponse.json({ error: "Invalid host" }, { status: 400 });

  const res = parsed.data.response as AuthenticationResponseJSON;
  const credId = res.id;
  if (!credId) return NextResponse.json({ error: "Missing credential id" }, { status: 400 });

  const rawId = (res as unknown as { rawId?: string }).rawId ?? "";
  const idBytes = decodeId(credId);
  const rawBytes = rawId ? decodeId(rawId) : null;
  if (!idBytes && !rawBytes) return NextResponse.json({ error: "Invalid credential id" }, { status: 400 });

  const cred = await prisma.passkeyCredential.findFirst({
    where: {
      OR: [
        ...(idBytes ? [{ credentialId: idBytes }] : []),
        ...(rawBytes ? [{ credentialId: rawBytes }] : []),
      ],
    },
    select: { id: true, userId: true, credentialId: true, publicKey: true, counter: true },
  });
  if (!cred) {
    return NextResponse.json(
      { error: "Unknown credential (נסה להפעיל Passkey מחדש במסך סיסמאות ואז להתחבר עם אימייל)" },
      { status: 401 },
    );
  }

  const verification = await verifyAuthenticationResponse({
    response: res,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credId,
      publicKey: new Uint8Array(cred.publicKey),
      counter: cred.counter,
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Not verified" }, { status: 401 });
  }

  await prisma.passkeyCredential.update({
    where: { id: cred.id },
    data: { counter: verification.authenticationInfo.newCounter },
    select: { id: true },
  });

  const user = await prisma.user.findUnique({ where: { id: cred.userId }, select: { id: true, email: true, theme: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

  if (parsed.data.expectUserId && parsed.data.expectUserId !== user.id) {
    return NextResponse.json(
      { error: "זה Passkey של חשבון אחר. השתמש ב־Face ID של החשבון המחובר." },
      { status: 403 },
    );
  }

  const token = await signSessionToken({ sub: user.id, email: user.email }, secret);
  await setSessionCookie(token);
  cs.set(THEME_COOKIE, normalizeAppTheme(user.theme), themeCookieOptions);

  // Clear challenge
  cs.set("webauthn_auth_challenge", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}

