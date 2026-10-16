import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { signSessionToken } from "@/app/lib/auth/session";
import { setSessionCookie } from "@/app/lib/auth/cookies";
import { syncBudgetCategoriesForUser } from "@/app/lib/categories/budget";
import { getSession } from "@/app/lib/auth/server";
import {
  defaultThemeForEmail,
  isAllowedAccountEmail,
  normalizeEmail,
} from "@/app/lib/auth/accounts";

const bodySchema = z.object({
  email: z.string().email(),
  inviteCode: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "חסר AUTH_SECRET בשרת" }, { status: 500 });

  const session = await getSession();
  if (session?.sub) {
    return NextResponse.json({ error: "כבר מחובר. התנתק כדי ליצור חשבון חדש." }, { status: 409 });
  }

  const expectedInvite = process.env.ACCOUNT_INVITE_CODE?.trim();
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }

  if (expectedInvite) {
    const provided = parsed.data.inviteCode?.trim() ?? "";
    if (provided !== expectedInvite) {
      return NextResponse.json({ error: "קוד הזמנה שגוי או חסר" }, { status: 403 });
    }
  }

  const email = normalizeEmail(parsed.data.email);
  if (!isAllowedAccountEmail(email)) {
    return NextResponse.json(
      { error: "אפשר להירשם רק עם האימייל של Noam." },
      { status: 403 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "כבר קיים חשבון עם האימייל הזה. התחבר עם ה־Passkey שלך." },
      { status: 409 },
    );
  }

  const theme = defaultThemeForEmail(email);
  const user = await prisma.user.create({
    data: { email, theme },
    select: { id: true, email: true },
  });

  await syncBudgetCategoriesForUser(user.id);

  const token = await signSessionToken({ sub: user.id, email: user.email }, secret);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, theme });
}
