import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getWebAuthnHost } from "@/app/lib/auth/webauthn";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().optional().nullable(),
  /** Prefer local biometrics (Touch ID / Windows Hello) or phone QR. */
  mode: z.enum(["device", "phone"]).optional().default("device"),
});

function parseTransports(raw: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const allowed = new Set(["internal", "hybrid", "usb", "nfc", "ble", "cable", "smart-card"]);
    const out = parsed.filter(
      (t): t is AuthenticatorTransportFuture => typeof t === "string" && allowed.has(t),
    );
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  const { rpID } = await getWebAuthnHost();
  if (!rpID) return NextResponse.json({ error: "Invalid host" }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const mode = parsed.data.mode ?? "device";
  const email = parsed.data.email?.toLowerCase().trim() ?? "";

  let allowCredentials:
    | Array<{ id: string; transports?: AuthenticatorTransportFuture[] }>
    | undefined;

  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const creds = await prisma.passkeyCredential.findMany({
        where: { userId: user.id },
        select: { credentialId: true, transports: true },
      });
      if (creds.length) {
        // Keep stored transports (usually internal+hybrid). Never force internal-only —
        // that makes Chrome say "No passkeys available" on a Mac that only has phone keys.
        allowCredentials = creds.map((c) => {
          const stored = parseTransports(c.transports);
          const transports: AuthenticatorTransportFuture[] =
            mode === "phone"
              ? ["hybrid", "internal"]
              : stored ?? ["internal", "hybrid"];
          return {
            id: Buffer.from(c.credentialId).toString("base64url"),
            transports,
          };
        });
      }
    }
  }

  const opts = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    ...(allowCredentials ? { allowCredentials } : {}),
  });

  const cs = await cookies();
  cs.set("webauthn_auth_challenge", opts.challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.json({
    ...opts,
    hints: mode === "phone" ? ["hybrid"] : ["client-device"],
  });
}
