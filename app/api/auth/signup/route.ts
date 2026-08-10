import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { hashPassword } from "@/app/lib/auth/password";
import { DEFAULT_CATEGORIES } from "@/app/lib/categories/defaults";

function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return "972" + digits.slice(-9);
}

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phoneNumber: z.string().min(9).max(20), // חובה – מקושר לחשבון לקבלת קבלות בוואטסאפ
});

export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "AUTH_SECRET is missing" }, { status: 500 });

  const existing = await prisma.user.count();
  if (existing === 0) {
    return NextResponse.json({ error: "Use /setup for first user" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email, password, phoneNumber } = parsed.data;
  const emailLower = email.toLowerCase();
  const phoneE164 = normalizePhoneE164(phoneNumber.trim());
  if (!phoneE164) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });

  const dup = await prisma.user.findUnique({
    where: { email: emailLower },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const phoneDup = await prisma.user.findFirst({
    where: { phoneNumber: phoneE164 },
    select: { id: true },
  });
  if (phoneDup) return NextResponse.json({ error: "Phone number already linked to another account" }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: emailLower,
      passwordHash,
      phoneNumber: phoneE164,
      approved: false, // ממתין לאישור מנהל
    },
    select: { id: true, email: true },
  });

  await prisma.category.createMany({
    data: [...DEFAULT_CATEGORIES].map((name) => ({ userId: user.id, name })),
  });

  // לא מכניסים להתחברות – רק אחרי אישור מנהל
  return NextResponse.json({ ok: true, pendingApproval: true });
}
