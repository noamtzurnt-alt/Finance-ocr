import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { prisma } from "@/app/lib/prisma";
import { getWebAuthnHost } from "@/app/lib/auth/webauthn";
import { cookies } from "next/headers";
import { signSessionToken } from "@/app/lib/auth/session";
import { setSessionCookie } from "@/app/lib/auth/cookies";

export const runtime = "nodejs";

const bodySchema = z.object({
  response: z.any(),
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
  const challenge = cs.get("webauthn_auth_challenge")?.value ?? "";
  if (!challenge) return NextResponse.json({ error: "Missing challenge" }, { status: 400 });

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
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credId,
      publicKey: new Uint8Array(cred.publicKey),
      counter: cred.counter,
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Not verified" }, { status: 401 });
  }

  await prisma.passkeyCredential.update({
    where: { id: cred.id },
    data: { counter: verification.authenticationInfo.newCounter },
    select: { id: true },
  });

  const user = await prisma.user.findUnique({ where: { id: cred.userId }, select: { id: true, email: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

  const token = await signSessionToken({ sub: user.id, email: user.email }, secret);
  await setSessionCookie(token);

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

