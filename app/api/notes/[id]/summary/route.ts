import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { noteSummaryHash, summarizeNote } from "@/app/lib/notes/summary";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Refreshes the list summary if the note changed since it was last summarized. */
export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const note = await prisma.note.findFirst({
    where: { id, userId: user.id },
    select: { title: true, content: true, summary: true, summaryHash: true, updatedAt: true },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hash = noteSummaryHash(note.title, note.content);
  if (note.summaryHash === hash) return NextResponse.json({ summary: note.summary });

  const summary = await summarizeNote(note.title, note.content);
  // Skip the write if the note was edited meanwhile; keep updatedAt so list order doesn't jump.
  await prisma.note.updateMany({
    where: { id, title: note.title, content: note.content },
    data: { summary, summaryHash: hash, updatedAt: note.updatedAt },
  });
  return NextResponse.json({ summary });
}
