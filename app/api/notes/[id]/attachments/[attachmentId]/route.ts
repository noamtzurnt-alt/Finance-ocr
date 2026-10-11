import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { deleteObject } from "@/app/lib/r2/objects";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: noteId, attachmentId } = await ctx.params;
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: user.id },
    select: { id: true },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachment = await prisma.noteAttachment.findFirst({
    where: { id: attachmentId, noteId },
    select: { id: true, fileKey: true },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteObject(attachment.fileKey);
  } catch {
    // ignore
  }
  await prisma.noteAttachment.delete({ where: { id: attachment.id } });
  await prisma.note.update({
    where: { id: noteId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
