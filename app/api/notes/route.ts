import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { sanitizeNoteHtml } from "@/app/lib/notes/html";
import { listNotes, loadNote, mapNote, noteSelect, ownsFolder } from "@/app/lib/notes/server";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().max(8_000).optional().nullable(),
  content: z.string().max(50_000).optional().nullable(),
  pinned: z.boolean().optional(),
  folderId: z.string().max(64).optional().nullable(),
  clientKey: z.string().min(1).max(80).optional().nullable(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listNotes(user.id));
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const title = sanitizeNoteHtml(parsed.data.title ?? "");
  const content = sanitizeNoteHtml(parsed.data.content ?? "");
  const titlePlain = title.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
  const plain = content.replace(/<[^>]+>/g, "").trim();
  if (!titlePlain && !plain) {
    return NextResponse.json({ error: "Empty note" }, { status: 400 });
  }

  const folderId = parsed.data.folderId || null;
  if (folderId && !(await ownsFolder(folderId, user.id))) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const clientKey = parsed.data.clientKey?.trim() || null;
  const data = {
    title,
    content,
    pinned: parsed.data.pinned ?? false,
    folderId,
  };

  if (clientKey) {
    const existing = await prisma.note.findFirst({
      where: { userId: user.id, clientKey },
      select: { id: true },
    });
    if (existing) {
      await prisma.note.update({ where: { id: existing.id }, data });
      return NextResponse.json(await loadNote(existing.id, user.id));
    }
  }

  try {
    const created = await prisma.note.create({
      data: { userId: user.id, clientKey, ...data },
      select: noteSelect,
    });
    return NextResponse.json(await mapNote(created));
  } catch (e) {
    const retry =
      clientKey && typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
    if (!retry) throw e;
    const existing = await prisma.note.findFirst({
      where: { userId: user.id, clientKey },
      select: { id: true },
    });
    if (!existing) throw e;
    await prisma.note.update({ where: { id: existing.id }, data });
    return NextResponse.json(await loadNote(existing.id, user.id));
  }
}
