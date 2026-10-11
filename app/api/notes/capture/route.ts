import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { sanitizeNoteHtml } from "@/app/lib/notes/html";

export const runtime = "nodejs";

const captureSchema = z.object({
  clientKey: z.string().min(1).max(80).optional().nullable(),
  noteId: z.string().max(80).optional().nullable(),
  folderId: z.string().max(64).optional().nullable(),
  title: z.string().max(8_000).optional().nullable(),
  content: z.string().max(50_000).optional().nullable(),
});

function plainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stores the note text on its own, even if creating the note itself fails. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = captureSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const title = sanitizeNoteHtml(parsed.data.title ?? "");
  const content = sanitizeNoteHtml(parsed.data.content ?? "");
  const text = plainText(content) || plainText(title);
  if (!text) return NextResponse.json({ error: "Empty note" }, { status: 400 });

  const clientKey = parsed.data.clientKey?.trim() || null;
  const noteId = parsed.data.noteId?.trim() || null;

  const previous = clientKey
    ? await prisma.noteCapture.findFirst({
        where: { userId: user.id, clientKey },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      })
    : null;
  if (previous && previous.content === content) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const saved = await prisma.noteCapture.create({
    data: { userId: user.id, clientKey, noteId, title, content },
    select: { id: true, createdAt: true },
  });

  console.info(
    "[note-capture]",
    JSON.stringify({
      id: saved.id,
      userId: user.id,
      clientKey,
      noteId,
      chars: text.length,
      text: text.slice(0, 8_000),
    }),
  );

  return NextResponse.json({ ok: true, id: saved.id });
}
