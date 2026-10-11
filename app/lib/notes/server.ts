import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getObjectReadUrl } from "@/app/lib/r2/objects";
import { noteSummaryHash } from "@/app/lib/notes/summary";

export const noteSelect = {
  id: true,
  title: true,
  content: true,
  pinned: true,
  summary: true,
  summaryHash: true,
  folderId: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  attachments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fileKey: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      createdAt: true,
    },
  },
} satisfies Prisma.NoteSelect;

type NoteRecord = Prisma.NoteGetPayload<{ select: typeof noteSelect }>;

export async function mapNote(n: NoteRecord) {
  const attachments = await Promise.all(
    n.attachments.map(async (a) => ({
      id: a.id,
      fileName: a.fileName,
      fileMime: a.fileMime,
      fileSize: a.fileSize,
      createdAt: a.createdAt.toISOString(),
      url: await getObjectReadUrl(a.fileKey, 60 * 30).catch(() => null),
    })),
  );
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    summary: n.summary,
    summaryStale: n.summaryHash !== noteSummaryHash(n.title, n.content),
    folderId: n.folderId,
    deletedAt: n.deletedAt ? n.deletedAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    attachments,
  };
}

export async function loadNote(id: string, userId: string) {
  const n = await prisma.note.findFirst({ where: { id, userId }, select: noteSelect });
  return n ? await mapNote(n) : null;
}

export async function listNotes(userId: string) {
  const rows = await prisma.note.findMany({
    where: { userId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: noteSelect,
  });
  return await Promise.all(rows.map(mapNote));
}

export async function listFolders(userId: string) {
  const rows = await prisma.noteFolder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, createdAt: true },
  });
  return rows.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt.toISOString() }));
}

export async function ownsFolder(folderId: string, userId: string) {
  const f = await prisma.noteFolder.findFirst({ where: { id: folderId, userId }, select: { id: true } });
  return Boolean(f);
}
