import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { normalizeAppTheme, THEME_COOKIE, themeCookieOptions } from "@/app/lib/ui/theme";

export const runtime = "nodejs";

const bodySchema = z.object({
  theme: z.enum(["green", "pink"]),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { theme: true },
  });

  return NextResponse.json({ theme: normalizeAppTheme(row?.theme) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "ערכת נושא לא תקינה" }, { status: 400 });
  }

  const theme = normalizeAppTheme(parsed.data.theme);
  await prisma.user.update({
    where: { id: user.id },
    data: { theme },
    select: { id: true },
  });

  const res = NextResponse.json({ ok: true, theme });
  res.cookies.set(THEME_COOKIE, theme, themeCookieOptions);
  return res;
}
