import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export const runtime = "nodejs";

/** Credential ids for a local Face ID check. No ceremony, no extra round trip on later opens. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ credentials: [] }, { status: 401, headers: { "cache-control": "no-store" } });

  const passkeys = await prisma.passkeyCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true },
  });

  return NextResponse.json(
    {
      credentials: passkeys.map((p) => ({
        id: Buffer.from(p.credentialId).toString("base64url"),
        transports: ["internal"] as const,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
