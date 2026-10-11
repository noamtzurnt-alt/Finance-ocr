import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { ownsSection, toSectionDto } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ name: z.string().trim().min(1).max(80), position: z.number() }).partial();

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await ownsSection(id, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const section = await prisma.reminderSection.update({ where: { id }, data: parsed.data });
  return NextResponse.json(toSectionDto(section));
}

/** Reminders in the section stay in the list, just without a section. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await ownsSection(id, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.reminderSection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
