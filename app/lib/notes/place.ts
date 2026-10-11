export type NotesPlaceView =
  | { kind: "folders" }
  | { kind: "all" }
  | { kind: "folder"; id: string }
  | { kind: "trash" };

export type NotesPlace = {
  view: NotesPlaceView;
  noteId: string | null;
  composing: boolean;
  ts: number;
};

export function parseNotesPlace(raw: unknown): NotesPlace | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const view = d.view;
  if (!view || typeof view !== "object") return null;
  const kind = (view as { kind?: unknown }).kind;
  if (kind !== "folders" && kind !== "all" && kind !== "folder" && kind !== "trash") return null;
  if (kind === "folder" && typeof (view as { id?: unknown }).id !== "string") return null;
  const ts = typeof d.ts === "number" && Number.isFinite(d.ts) ? d.ts : 0;
  return {
    view: view as NotesPlaceView,
    noteId: typeof d.noteId === "string" ? d.noteId : null,
    composing: d.composing === true,
    ts,
  };
}

export function newerPlace(a: NotesPlace | null, b: NotesPlace | null): NotesPlace | null {
  if (!a) return b;
  if (!b) return a;
  return a.ts >= b.ts ? a : b;
}
