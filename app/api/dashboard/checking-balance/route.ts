import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amount: z.number().min(-100_000_000).max(100_000_000),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
  }

  const checkingBalance = parsed.data.amount.toFixed(2);
  await prisma.financialProfile.upsert({
    where: { userId: user.id },
    update: { checkingBalance },
    create: { userId: user.id, checkingBalance },
  });

  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, checkingBalance });
}