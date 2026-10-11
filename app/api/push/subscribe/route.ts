import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { DEFAULT_TZ, isValidTimeZone } from "@/app/lib/reminders/push";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Push is not configured" }, { status: 503 });
  return NextResponse.json({ publicKey }, { headers: { "cache-control": "no-store" } });
}

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(256) }),
  timeZone: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = subscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  const { endpoint, keys } = parsed.data;
  const timeZone = parsed.data.timeZone && isValidTimeZone(parsed.data.timeZone) ? parsed.data.timeZone : DEFAULT_TZ;
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 300);

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, timeZone, userAgent },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, timeZone, userAgent, lastUsedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ endpoint: z.string().max(2048) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
