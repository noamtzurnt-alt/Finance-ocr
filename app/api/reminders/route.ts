import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { loadReminders } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadReminders(user.id), { headers: { "cache-control": "no-store" } });
}
