import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  deviceName: z.string().trim().min(1).max(60),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "שם מכשיר לא תקין" }, { status: 400 });
  }

  const existing = await prisma.passkeyCredential.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Passkey לא נמצא" }, { status: 404 });

  const updated = await prisma.passkeyCredential.update({
    where: { id },
    data: { deviceName: parsed.data.deviceName },
    select: { id: true, deviceName: true, createdAt: true },
  });

  return NextResponse.json({
    id: updated.id,
    deviceName: updated.deviceName,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.passkeyCredential.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Passkey לא נמצא" }, { status: 404 });

  const remaining = await prisma.passkeyCredential.count({ where: { userId: user.id } });
  if (remaining <= 1) {
    return NextResponse.json(
      { error: "אי אפשר למחוק את ה־Passkey האחרון. הוסף מכשיר אחר קודם." },
      { status: 400 },
    );
  }

  await prisma.passkeyCredential.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
