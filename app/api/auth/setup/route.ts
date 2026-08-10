import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { hashPassword } from "@/app/lib/auth/password";
import { signSessionToken } from "@/app/lib/auth/session";
import { setSessionCookie } from "@/app/lib/auth/cookies";
import { DEFAULT_CATEGORIES } from "@/app/lib/categories/defaults";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "AUTH_SECRET is missing" }, { status: 500 });

  const existing = await prisma.user.count();
  if (existing > 0) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 409 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, isAdmin: true, approved: true },
    select: { id: true, email: true },
  });

  // seed default categories
  await prisma.category.createMany({
    data: [...DEFAULT_CATEGORIES].map((name) => ({ userId: user.id, name })),
  });

  const token = await signSessionToken({ sub: user.id, email: user.email }, secret);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}


