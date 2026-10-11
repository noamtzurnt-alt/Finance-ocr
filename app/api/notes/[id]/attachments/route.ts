import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectReadUrl, putObject } from "@/app/lib/r2/objects";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: noteId } = await ctx.params;
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: user.id },
    select: { id: true, _count: { select: { attachments: true } } },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (note._count.attachments >= 12) {
    return NextResponse.json({ error: "מקסימום 12 קבצים להערה" }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "קובץ לא תקין או גדול מדי (עד 12MB)" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime) && !mime.startsWith("image/")) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^\w.\-()\u0590-\u05FF ]+/g, "_").slice(0, 120) || "file";
  const fileKey = `${user.id}/notes/${noteId}/${Date.now()}-${safeName}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  await putObject({ key: fileKey, body: buffer, contentType: mime });

  const created = await prisma.noteAttachment.create({
    data: {
      noteId,
      fileKey,
      fileName: safeName,
      fileMime: mime,
      fileSize: file.size,
    },
    select: {
      id: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      createdAt: true,
      fileKey: true,
    },
  });

  await prisma.note.update({
    where: { id: noteId },
    data: { updatedAt: new Date() },
  });

  const url = await getObjectReadUrl(created.fileKey, 60 * 30).catch(() => null);
  return NextResponse.json({
    id: created.id,
    fileName: created.fileName,
    fileMime: created.fileMime,
    fileSize: created.fileSize,
    createdAt: created.createdAt.toISOString(),
    url,
  });
}
