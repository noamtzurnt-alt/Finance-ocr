import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth/server";
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
  phoneNumber: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email, password, phoneNumber } = parsed.data;
  const emailLower = email.toLowerCase();
  const phoneE164 = phoneNumber?.trim() ? normalizePhoneE164(phoneNumber.trim()) : null;

  const dup = await prisma.user.findUnique({
    where: { email: emailLower },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  if (phoneE164) {
    const phoneDup = await prisma.user.findFirst({
      where: { phoneNumber: phoneE164 },
      select: { id: true },
    });
    if (phoneDup) return NextResponse.json({ error: "Phone number already linked to another account" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: emailLower,
      passwordHash,
      phoneNumber: phoneE164,
      approved: true, // מנהל יוצר → מאושר מיד
    },
    select: { id: true, email: true, phoneNumber: true },
  });

  await prisma.category.createMany({
    data: [...DEFAULT_CATEGORIES].map((name) => ({ userId: user.id, name })),
  });

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, phoneNumber: user.phoneNumber } });
}

/** רשימת משתמשים – למנהל: ממתינים לאישור + כולם */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    select: { id: true, email: true, phoneNumber: true, approved: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const pending = users.filter((u) => !u.approved);
  const approved = users.filter((u) => u.approved);

  return NextResponse.json({ pending, approved });
}
