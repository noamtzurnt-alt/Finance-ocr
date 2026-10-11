/**
 * Called every minute by Supabase pg_cron (pg_net) — Vercel Hobby crons are daily only.
 * Auth: Authorization: Bearer PUSH_CRON_SECRET.
 */
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runReminderPush } from "@/app/lib/reminders/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await runReminderPush();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
