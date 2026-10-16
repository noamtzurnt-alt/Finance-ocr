import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { parseMonthKey } from "@/app/lib/budget/months";
import { getDashboardSummary, InvalidDashboardMonthError } from "@/app/lib/dashboard/summary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = new URL(req.url).searchParams.get("month");
  if (month && !parseMonthKey(month)) {
    return NextResponse.json({ error: "חודש לא תקין" }, { status: 400 });
  }

  try {
    const summary = await getDashboardSummary(user.id, month ?? undefined);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof InvalidDashboardMonthError) {
      return NextResponse.json({ error: "חודש לא תקין" }, { status: 400 });
    }
    throw error;
  }
}
