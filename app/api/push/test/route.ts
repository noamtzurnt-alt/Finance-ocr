import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { pushConfigured, sendToUser } from "@/app/lib/reminders/push";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "Push is not configured" }, { status: 503 });
  const res = await sendToUser(user.id, {
    title: "ההתראות עובדות 🎉",
    body: "כך ייראו התזכורות שלך.",
    tag: "test",
    url: "/reminders",
  });
  if (!res.sent) return NextResponse.json({ error: "לא נמצא מכשיר רשום להתראות" }, { status: 404 });
  return NextResponse.json({ ok: true, ...res });
}
