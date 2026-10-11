import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { ownsFolder } from "@/app/lib/notes/server";

export const runtime = "nodejs";

const updateSchema = z.object({ name: z.string().trim().min(1).max(80) });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await ownsFolder(id, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "שם תיקייה לא תקין" }, { status: 400 });

  const f = await prisma.noteFolder.update({
    where: { id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, createdAt: true },
  });
  return NextResponse.json({ id: f.id, name: f.name, createdAt: f.createdAt.toISOString() });
}

/** Deletes the folder; its notes move to "Recently Deleted". */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await ownsFolder(id, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  await prisma.$transaction([
    prisma.note.updateMany({
      where: { userId: user.id, folderId: id, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.noteFolder.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true, deletedAt: now.toISOString() });
}
