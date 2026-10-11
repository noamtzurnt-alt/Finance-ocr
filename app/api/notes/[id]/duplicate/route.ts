import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectBytes, putObject } from "@/app/lib/r2/objects";
import { loadNote } from "@/app/lib/notes/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const source = await prisma.note.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: {
      title: true,
      content: true,
      pinned: true,
      summary: true,
      summaryHash: true,
      folderId: true,
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { fileKey: true, fileName: true, fileMime: true, fileSize: true },
      },
    },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await prisma.note.create({
    data: {
      userId: user.id,
      title: source.title,
      content: source.content,
      pinned: source.pinned,
      summary: source.summary,
      summaryHash: source.summaryHash,
      folderId: source.folderId,
    },
    select: { id: true },
  });

  for (const [i, a] of source.attachments.entries()) {
    try {
      const bytes = await getObjectBytes(a.fileKey);
      const fileKey = `${user.id}/notes/${copy.id}/${Date.now()}-${i}-${a.fileName}`;
      await putObject({ key: fileKey, body: new Uint8Array(bytes), contentType: a.fileMime });
      await prisma.noteAttachment.create({
        data: { noteId: copy.id, fileKey, fileName: a.fileName, fileMime: a.fileMime, fileSize: a.fileSize },
      });
    } catch {
      // A missing source object should not block duplicating the text.
    }
  }

  return NextResponse.json(await loadNote(copy.id, user.id));
}
