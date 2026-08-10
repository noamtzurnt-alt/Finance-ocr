import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { newMorningWebhookSecret, newMorningWebhookToken } from "@/app/lib/morning/webhook";

function appBaseUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "";
}

function buildWebhookUrl(base: string, token: string, secret: string) {
  // Morning's webhook UI has a separate Secret field but delivery via header is unreliable;
  // we keep secret in the query so verification always works. Token alone is not enough.
  // Do not paste this URL into browsers/chats — treat it like a password.
  return `${base}/api/webhooks/morning?token=${encodeURIComponent(token)}&secret=${encodeURIComponent(secret)}`;
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { morningWebhookToken: true, morningWebhookSecret: true },
  });

  const token = dbUser?.morningWebhookToken ?? null;
  const secret = dbUser?.morningWebhookSecret ?? null;
  const base = appBaseUrl(req);
  const webhookUrl = token && secret && base ? buildWebhookUrl(base, token, secret) : null;

  const events = await prisma.morningWebhookEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      httpStatus: true,
      summary: true,
      detail: true,
      morningDocId: true,
      morningType: true,
      morningNumber: true,
      documentId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    enabled: Boolean(token && secret),
    webhookUrl,
    secret,
    hasToken: Boolean(token),
    events,
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = json?.action ?? "enable";

  if (action === "disable") {
    await prisma.user.update({
      where: { id: user.id },
      data: { morningWebhookToken: null, morningWebhookSecret: null },
    });
    return NextResponse.json({ enabled: false, webhookUrl: null, secret: null });
  }

  // enable or rotate — always mint both token + secret
  const token = newMorningWebhookToken();
  const secret = newMorningWebhookSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { morningWebhookToken: token, morningWebhookSecret: secret },
  });

  const base = appBaseUrl(req);
  const webhookUrl = base ? buildWebhookUrl(base, token, secret) : null;

  return NextResponse.json({
    enabled: true,
    webhookUrl,
    secret,
    rotated: action === "rotate",
  });
}
