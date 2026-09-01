import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { getDashboardSummary } from "@/app/lib/dashboard/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await getDashboardSummary(user.id);
  return NextResponse.json(summary);
}
