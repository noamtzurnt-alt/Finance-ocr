import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { parseNotesPlace, type NotesPlace } from "@/app/lib/notes/place";

export const runtime = "nodejs";

const bodySchema = z.object({
  view: z.object({
    kind: z.enum(["folders", "all", "folder", "trash"]),
    id: z.string().min(1).max(64).optional(),
  }),
  noteId: z.string().max(64).nullable(),
  composing: z.boolean(),
  ts: z.number().int().positive(),
});

function toPlace(raw: unknown): NotesPlace | null {
  return parseNotesPlace(raw);
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notesPlace: true },
  });

  return NextResponse.json({ place: toPlace(row?.notesPlace) });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (parsed.data.view.kind === "folder" && !parsed.data.view.id) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const place: NotesPlace = {
    view:
      parsed.data.view.kind === "folder"
        ? { kind: "folder", id: parsed.data.view.id! }
        : { kind: parsed.data.view.kind },
    noteId: parsed.data.noteId,
    composing: parsed.data.composing,
    ts: parsed.data.ts,
  };

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notesPlace: true },
  });
  const current = toPlace(existing?.notesPlace);
  if (current && current.ts > place.ts) {
    return NextResponse.json({ place: current, applied: false });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notesPlace: place,
      notesPlaceAt: new Date(place.ts),
    },
    select: { id: true },
  });

  return NextResponse.json({ place, applied: true });
}
