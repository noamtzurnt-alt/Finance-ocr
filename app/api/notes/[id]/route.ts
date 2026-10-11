import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { deleteObject } from "@/app/lib/r2/objects";
import { sanitizeNoteHtml } from "@/app/lib/notes/html";
import { loadNote, ownsFolder } from "@/app/lib/notes/server";

export const runtime = "nodejs";

const updateSchema = z.object({
  title: z.string().max(8_000).optional(),
  content: z.string().max(50_000).optional(),
  pinned: z.boolean().optional(),
  folderId: z.string().max(64).nullable().optional(),
  // true = move to "Recently Deleted", false = restore.
  deleted: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.note.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: { title?: string; content?: string; pinned?: boolean; folderId?: string | null; deletedAt?: Date | null } = {};
  if (parsed.data.title !== undefined) data.title = sanitizeNoteHtml(parsed.data.title);
  if (parsed.data.content !== undefined) data.content = sanitizeNoteHtml(parsed.data.content);
  if (parsed.data.pinned !== undefined) data.pinned = parsed.data.pinned;
  if (parsed.data.folderId !== undefined) {
    if (parsed.data.folderId && !(await ownsFolder(parsed.data.folderId, user.id))) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    data.folderId = parsed.data.folderId;
  }
  if (parsed.data.deleted !== undefined) data.deletedAt = parsed.data.deleted ? new Date() : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.note.update({ where: { id }, data });
  return NextResponse.json(await loadNote(id, user.id));
}

/** Permanent delete (used from "Recently Deleted"). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.note.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      attachments: { select: { fileKey: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const a of existing.attachments) {
    try {
      await deleteObject(a.fileKey);
    } catch {
      // ignore cleanup errors
    }
  }

  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
