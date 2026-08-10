import { NextResponse } from "next/server";
import { syncAllGmailConnections } from "@/app/lib/gmail/sync";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 500, headers: JSON_HEADERS });
  }

  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret") ?? "";
  if (auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: JSON_HEADERS });
  }

  try {
    const results = await syncAllGmailConnections();
    const imported = results.reduce((s, r) => s + r.imported, 0);
    return NextResponse.json({ ok: true, connections: results.length, imported, results }, { headers: JSON_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSON_HEADERS });
  }
}
