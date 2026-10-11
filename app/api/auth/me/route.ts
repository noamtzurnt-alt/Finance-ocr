import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectReadUrl } from "@/app/lib/r2/objects";
import {
  chatLabelForEmail,
  displayNameForEmail,
  showBusinessNavForEmail,
} from "@/app/lib/auth/accounts";
import { normalizeAppTheme, THEME_COOKIE, themeCookieOptions } from "@/app/lib/ui/theme";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, theme: true, logoKey: true },
  });
  if (!row) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let logoUrl: string | null = null;
  if (row.logoKey) {
    try {
      logoUrl = await getObjectReadUrl(row.logoKey, 60 * 60);
    } catch {
      logoUrl = null;
    }
  }

  const theme = normalizeAppTheme(row.theme);
  const res = NextResponse.json({
    email: row.email,
    displayName: displayNameForEmail(row.email),
    chatLabel: chatLabelForEmail(row.email),
    theme,
    showBusiness: showBusinessNavForEmail(row.email),
    logoUrl,
    canCustomizeLogo: true,
  });
  res.cookies.set(THEME_COOKIE, theme, themeCookieOptions);
  return res;
}
