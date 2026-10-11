"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AppModal from "@/app/ui/AppModal";
import { PressMenu, PressableRow, type MenuItem } from "@/app/ui/PressMenu";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconCheck,
  IconFolder,
  IconFolderPlus,
  IconNotes,
  IconPencil,
  IconRefresh,
  IconStar,
  IconTrash,
} from "@/app/ui/icons";
import {
  looksLikeHtml,
  notePlainPreview,
  noteTitleFromContent,
  plainTextToNoteHtml,
  sanitizeNoteHtml,
} from "@/app/lib/notes/html";
import { newerPlace, parseNotesPlace, type NotesPlace, type NotesPlaceView } from "@/app/lib/notes/place";

export type NoteAttachment = {
  id: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  createdAt: string;
  url: string | null;
};

export type NoteRow = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  summary: string;
  summaryStale: boolean;
  folderId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: NoteAttachment[];
};

export type NoteFolderRow = { id: string; name: string; createdAt: string };

type NotesView = NotesPlaceView;

const COLORS = ["#f4f4f4", "#00d26a", "#ff4fa3", "#60a5fa", "#fbbf24", "#f87171"];
const HIGHLIGHTS = [
  "transparent",
  "rgba(0,210,106,0.35)",
  "rgba(255,79,163,0.35)",
  "rgba(96,165,250,0.35)",
  "rgba(251,191,36,0.4)",
];
const FONT_SIZES = [
  { label: "קטן", value: "3" },
  { label: "רגיל", value: "4" },
  { label: "גדול", value: "5" },
  { label: "ענק", value: "6" },
];

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

type NoteSection = { key: string; label: string; notes: NoteRow[] };

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}


function sectionKeyForDate(iso: string, now = new Date()): { key: string; label: string; order: number } {
  const d = new Date(iso);
  const today = startOfDay(now);
  const day = startOfDay(d);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);

  if (diffDays === 0) return { key: "today", label: "\u05d4\u05d9\u05d5\u05dd", order: 1 };
  if (diffDays === 1) return { key: "yesterday", label: "\u05d0\u05ea\u05de\u05d5\u05dc", order: 2 };
  if (diffDays >= 2 && diffDays <= 7) {
    return { key: "week", label: "7 \u05d4\u05d9\u05de\u05d9\u05dd \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d9\u05dd", order: 3 };
  }

  const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
  const label =
    d.getFullYear() === now.getFullYear()
      ? HEBREW_MONTHS[d.getMonth()]
      : `${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const order = 1000 - (d.getFullYear() * 12 + d.getMonth());
  return { key: `m-${monthKey}`, label, order };
}

function groupNotes(list: NoteRow[]): NoteSection[] {
  const pinned = list
    .filter((n) => n.pinned)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const buckets = new Map<string, { label: string; order: number; notes: NoteRow[] }>();
  for (const note of list.filter((n) => !n.pinned)) {
    const meta = sectionKeyForDate(note.updatedAt);
    const bucket = buckets.get(meta.key) ?? { label: meta.label, order: meta.order, notes: [] };
    bucket.notes.push(note);
    buckets.set(meta.key, bucket);
  }

  for (const bucket of buckets.values()) {
    bucket.notes.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  const sections: NoteSection[] = [];
  if (pinned.length > 0) {
    sections.push({ key: "pinned", label: "\u05e0\u05e2\u05d5\u05e6\u05d9\u05dd", notes: pinned });
  }

  const dated = [...buckets.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.order - b.order);

  for (const s of dated) {
    sections.push({ key: s.key, label: s.label, notes: s.notes });
  }
  return sections;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function textForEditor(note: { title: string; content: string }) {
  if (noteTitleFromContent(note.content)) return note.content;
  const title = notePlainPreview(note.title, 80);
  return title ? plainTextToNoteHtml(title) : "";
}

function contentForEditor(raw: string) {
  if (!raw.trim()) return "";
  if (looksLikeHtml(raw)) return raw;
  return plainTextToNoteHtml(raw);
}

/** Keep each line in its own block so the first line can stay the large bold title. */
function normalizeNoteBlocks(root: HTMLElement) {
  const sel = document.getSelection();
  const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  const anchorNode = range?.startContainer ?? null;
  const anchorOffset = range?.startOffset ?? 0;
  let moved = false;
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    if (!node.textContent) {
      node.remove();
      moved = true;
      continue;
    }
    const wrap = document.createElement("div");
    node.before(wrap);
    wrap.appendChild(node);
    moved = true;
  }
  if (!moved || !range || !anchorNode || !sel || !root.contains(anchorNode)) return;
  const next = document.createRange();
  const max = anchorNode.nodeType === Node.TEXT_NODE ? (anchorNode.textContent?.length ?? 0) : anchorNode.childNodes.length;
  next.setStart(anchorNode, Math.min(anchorOffset, max));
  next.collapse(true);
  sel.removeAllRanges();
  sel.addRange(next);
}

function placeCaretInNote(root: HTMLElement, x: number, y: number) {
  const sel = document.getSelection();
  if (!sel) return;
  const doc = document as Document & {
    caretRangeFromPoint?: (px: number, py: number) => Range | null;
    caretPositionFromPoint?: (px: number, py: number) => { offsetNode: Node; offset: number } | null;
  };
  let range: Range | null = null;
  if (typeof doc.caretRangeFromPoint === "function") range = doc.caretRangeFromPoint(x, y);
  else if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range || !root.contains(range.startContainer)) {
    range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
  }
  root.focus();
  sel.removeAllRanges();
  sel.addRange(range);
}

const FONT_SIZE_CSS: Record<string, string> = {
  "1": "0.8rem",
  "2": "0.9rem",
  "3": "1rem",
  "4": "1.15rem",
  "5": "1.45rem",
  "6": "1.8rem",
  "7": "2.15rem",
};

/** iOS drops the selection when a toolbar button is tapped, and execCommand then no-ops. */
function applyFormat(root: HTMLElement, cmd: string, value: string | undefined, range: Range) {
  const sel = document.getSelection();
  if (!sel) return;
  const live = sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0) : null;
  if (!live || !root.contains(live.commonAncestorContainer)) {
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const before = root.innerHTML;
  try {
    document.execCommand("styleWithCSS", false, "true");
    if (cmd === "hiliteColor") {
      document.execCommand("hiliteColor", false, value);
      if (root.innerHTML === before) document.execCommand("backColor", false, value);
    } else {
      document.execCommand(cmd, false, value);
    }
  } catch {
    // fall through to the manual wrap
  }
  if (root.innerHTML !== before) return;

  const currentSel = document.getSelection();
  if (!currentSel || currentSel.rangeCount === 0 || currentSel.isCollapsed) return;
  const current = currentSel.getRangeAt(0);
  if (!root.contains(current.commonAncestorContainer)) return;
  const span = document.createElement("span");
  if (cmd === "bold") span.style.fontWeight = "800";
  else if (cmd === "italic") span.style.fontStyle = "italic";
  else if (cmd === "underline") span.style.textDecoration = "underline";
  else if (cmd === "strikeThrough") span.style.textDecoration = "line-through";
  else if (cmd === "foreColor" && value) span.style.color = value;
  else if (cmd === "hiliteColor" && value && value !== "transparent") span.style.backgroundColor = value;
  else if (cmd === "fontSize" && value) span.style.fontSize = FONT_SIZE_CSS[value] ?? "1.15rem";
  else return;
  span.appendChild(current.extractContents());
  current.insertNode(span);
  const next = document.createRange();
  next.selectNodeContents(span);
  currentSel.removeAllRanges();
  currentSel.addRange(next);
}

function sortNotes(list: NoteRow[]) {
  return [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

const AUTOSAVE_DELAY_MS = 500;
const AUTOSAVE_RETRY_MS = 3000;
const NOTES_POLL_MS = 15_000;
const DRAFT_KEY = "nf_notes_draft_v1";
const OUTBOX_KEY = "nf_notes_outbox_v1";
const PLACE_KEY = "nf_notes_place_v1";
const SYNC_NOTICE = "הפתק נשמר במכשיר, אבל לא עלה לשרת. הוא יישמר שם כשיש חיבור.";

type OutboxItem = {
  clientKey: string;
  id: string | null;
  folderId: string | null;
  title: string;
  content: string;
  pinned: boolean;
  ts: number;
};

function newClientKey() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function outboxHasText(item: { title: string; content: string }) {
  return Boolean(
    noteTitleFromContent(item.content) || notePlainPreview(item.title, 200) || notePlainPreview(item.content, 200),
  );
}

function htmlHasText(html: string) {
  return Boolean(notePlainPreview(html, 400));
}

function readOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const parsed = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    const items = Array.isArray(parsed)
      ? parsed.filter((d) => typeof d?.clientKey === "string" && typeof d.content === "string")
      : [];
    const legacyRaw = localStorage.getItem(DRAFT_KEY);
    if (legacyRaw) {
      const d = JSON.parse(legacyRaw) as Partial<OutboxItem> & { id?: string | null };
      if (typeof d?.content === "string" && outboxHasText({ title: d.title ?? "", content: d.content })) {
        const clientKey = d.clientKey || d.id || newClientKey();
        if (!items.some((i) => i.clientKey === clientKey || (d.id && i.id === d.id))) {
          items.push({
            clientKey,
            id: d.id ?? null,
            folderId: d.folderId ?? null,
            title: d.title ?? "",
            content: d.content,
            pinned: Boolean(d.pinned),
            ts: typeof d.ts === "number" ? d.ts : Date.now(),
          });
        }
        localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
      }
      localStorage.removeItem(DRAFT_KEY);
    }
    return items;
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]) {
  try {
    if (items.length === 0) localStorage.removeItem(OUTBOX_KEY);
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {}
}

function upsertOutbox(item: OutboxItem) {
  const items = readOutbox().filter((i) => i.clientKey !== item.clientKey);
  if (outboxHasText(item)) items.push(item);
  writeOutbox(items);
}

/** Backup copy on the server. Independent of the normal note save. */
function postNoteCapture(item: OutboxItem, keepalive = false) {
  if (!outboxHasText(item)) return;
  const body = JSON.stringify({
    clientKey: item.clientKey,
    noteId: item.id,
    folderId: item.folderId,
    title: item.title,
    content: item.content,
  });
  void fetch("/api/notes/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: keepalive && body.length < 60_000,
  }).catch(() => {});
}

function removeOutbox(clientKey: string) {
  writeOutbox(readOutbox().filter((i) => i.clientKey !== clientKey));
}

function localRow(item: OutboxItem): NoteRow {
  const iso = new Date(item.ts).toISOString();
  return {
    id: item.id || item.clientKey,
    title: noteTitleFromContent(item.content) || item.title,
    content: item.content,
    pinned: item.pinned,
    summary: "",
    summaryStale: false,
    folderId: item.folderId,
    deletedAt: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

function mergeNoteLists(server: NoteRow[], outbox: OutboxItem[], keep: NoteRow[] = [], keepIds?: Set<string>): NoteRow[] {
  const byId = new Map(server.map((n) => [n.id, n]));
  for (const item of outbox) {
    if (!outboxHasText(item)) continue;
    if (item.id && byId.has(item.id)) {
      const serverNote = byId.get(item.id)!;
      if (item.ts > new Date(serverNote.updatedAt).getTime() && item.content !== serverNote.content) {
        byId.set(item.id, {
          ...serverNote,
          title: noteTitleFromContent(item.content) || item.title,
          content: item.content,
          pinned: item.pinned,
          updatedAt: new Date(item.ts).toISOString(),
        });
      }
      continue;
    }
    if (!item.id) byId.set(item.clientKey, localRow(item));
  }
  for (const n of keep) {
    if (keepIds?.has(n.id) && !byId.has(n.id)) byId.set(n.id, n);
  }
  return sortNotes([...byId.values()]);
}

function writePlace(place: NotesPlace) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify(place));
  } catch {}
}

function readPlace(): NotesPlace | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    if (!raw) return null;
    return parseNotesPlace(JSON.parse(raw));
  } catch {
    return null;
  }
}

const NoteSurface = memo(function NoteSurface({ mount }: { mount: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={mount}
      className="notes-paper-body notes-paper-body--reader"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="תוכן הפתק"
      data-placeholder={"התחל לכתוב…"}
    />
  );
});

function pushPlace(place: NotesPlace, keepalive = false) {
  void fetch("/api/notes/place", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(place),
    keepalive,
  }).catch(() => {});
}

export default function NotesClient(props: {
  initial: NoteRow[];
  folders: NoteFolderRow[];
  savedPlace: NotesPlace | null;
}) {
  const [items, setItems] = useState<NoteRow[]>(props.initial);
  const [folders, setFolders] = useState<NoteFolderRow[]>(props.folders);
  const [view, setView] = useState<NotesView>({ kind: "all" });
  const [placeReady, setPlaceReady] = useState(false);
  const [menu, setMenu] = useState<{ anchor: DOMRect; title: string; items: MenuItem[] } | null>(null);
  const [folderDialog, setFolderDialog] = useState<{ id: string | null; name: string } | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPinned, setDraftPinned] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState<NoteAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [linkPicker, setLinkPicker] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkBack, setLinkBack] = useState<{ id: string; title: string }[]>([]);
  const [moveNote, setMoveNote] = useState<NoteRow | null>(null);
  const [moveFolderName, setMoveFolderName] = useState("");

  const bodyRef = useRef<HTMLDivElement>(null);
  const mountBody = useRef((el: HTMLDivElement | null) => {
    bodyRef.current = el;
  }).current;
  const onEditorInputRef = useRef(() => {});
  const onEditorClickRef = useRef<(e: MouseEvent) => void>(() => {});
  const pendingFill = useRef<{ content: string; focus?: boolean; resumeDirty?: boolean; id: string | null } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const editingIdRef = useRef<string | null>(null);
  const viewRef = useRef<NotesView>({ kind: "all" });
  const editorOpenRef = useRef(false);
  const placeReadyRef = useRef(false);
  const skipPushRef = useRef(true);
  const placeTsRef = useRef(0);
  const itemsRef = useRef(props.initial);
  const pinnedRef = useRef(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const uploadingRef = useRef(false);
  const pendingFilesRef = useRef<File[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRef = useRef(props.initial);
  const newFolderRef = useRef<string | null>(null);
  const composingRef = useRef(false);
  const discardingRef = useRef(false);
  const clientKeyRef = useRef("");
  const ackedHtmlRef = useRef("");
  const ackedPinnedRef = useRef(false);
  const lastGoodHtmlRef = useRef("");
  const userEmptiedRef = useRef(false);
  const savedIdsRef = useRef(new Set<string>());
  const lastCaptureRef = useRef("");

  useEffect(() => {
    setMounted(true);
  }, []);

  viewRef.current = view;
  editorOpenRef.current = editorOpen;
  placeReadyRef.current = placeReady;

  // Reopen the last project, and the open note if the app was left inside one.
  // The newer timestamp wins, so the phone and the computer share one place.
  useLayoutEffect(() => {
    const local = readPlace();
    const place = newerPlace(local, props.savedPlace);
    if (local && props.savedPlace && local.ts > props.savedPlace.ts) pushPlace(local);
    else if (place) writePlace(place);
    placeTsRef.current = place?.ts ?? 0;
    skipPushRef.current = true;
    const outbox = readOutbox().filter(outboxHasText);
    setItems((prev) => mergeNoteLists(prev, outbox, prev, savedIdsRef.current));

    let nextView: NotesView = { kind: "all" };
    if (place?.view.kind === "folder") {
      const folderId = place.view.id;
      nextView = props.folders.some((f) => f.id === folderId) ? place.view : { kind: "all" };
    } else if (place && (place.view.kind === "folders" || place.view.kind === "trash" || place.view.kind === "all")) {
      nextView = place.view;
    }
    setView(nextView);

    if (place?.composing && place.noteId) {
      const note = initialRef.current.find((n) => n.id === place.noteId && !n.deletedAt);
      const pending = outbox.find((item) => item.id === place.noteId);
      const pendingNewer = Boolean(
        note && pending && pending.ts > new Date(note.updatedAt).getTime() && pending.content !== note.content,
      );
      if (note) {
        openComposer({
          id: note.id,
          clientKey: pending?.clientKey || note.id,
          pinned: pendingNewer && pending ? pending.pinned : note.pinned,
          folderId: note.folderId,
          content: pendingNewer && pending ? pending.content : textForEditor(note),
          attachments: note.attachments ?? [],
          resumeDirty: pendingNewer,
        });
      } else if (pending) {
        openComposer({
          id: pending.id,
          clientKey: pending.clientKey,
          pinned: pending.pinned,
          folderId: pending.folderId,
          content: pending.content,
          resumeDirty: true,
        });
      }
    } else if (place?.composing) {
      const pending = outbox.find((item) => !item.id);
      if (pending) {
        openComposer({
          id: null,
          clientKey: pending.clientKey,
          pinned: pending.pinned,
          folderId: pending.folderId,
          content: pending.content,
          resumeDirty: true,
          focus: true,
        });
      }
    }

    setPlaceReady(true);
    // Restore once from the first server payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!placeReady) return;
    if (skipPushRef.current) {
      skipPushRef.current = false;
      writePlace({
        view,
        noteId: editorOpen ? editingId : null,
        composing: editorOpen,
        ts: placeTsRef.current,
      });
      return;
    }
    const place: NotesPlace = {
      view,
      noteId: editorOpen ? editingId : null,
      composing: editorOpen,
      ts: Date.now(),
    };
    placeTsRef.current = place.ts;
    writePlace(place);
    pushPlace(place);
  }, [placeReady, view, editorOpen, editingId]);

  useLayoutEffect(() => {
    const pending = pendingFill.current;
    if (!editorOpen || !pending || !bodyRef.current) return;
    pendingFill.current = null;
    bodyRef.current.innerHTML = contentForEditor(pending.content);
    normalizeNoteBlocks(bodyRef.current);
    try {
      document.execCommand("defaultParagraphSeparator", false, "div");
    } catch {}
    if (pending.focus) bodyRef.current.focus({ preventScroll: true });
    else scrollRef.current?.scrollTo({ top: 0 });
    if (pending.resumeDirty) markDirty();
    else ackedHtmlRef.current = bodyRef.current.innerHTML.trim();
  }, [editorOpen, editingId]);

  useEffect(() => {
    const stale = initialRef.current.filter((n) => !n.deletedAt && n.summaryStale).slice(0, 20);
    if (stale.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const n of stale) {
        if (cancelled) return;
        await refreshSummary(n.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onNav = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "/notes") return;
      setMenu(null);
      setView({ kind: "all" });
      if (editorOpen) void closeEditor();
    };
    window.addEventListener("nf:nav", onNav);
    return () => window.removeEventListener("nf:nav", onNav);
  });

  useEffect(() => {
    const publishExit = (keepalive: boolean) => {
      if (!placeReadyRef.current) return;
      const place: NotesPlace = {
        view: viewRef.current,
        noteId: editorOpenRef.current ? editingIdRef.current : null,
        composing: editorOpenRef.current,
        ts: Date.now(),
      };
      placeTsRef.current = place.ts;
      writePlace(place);
      pushPlace(place, keepalive);
    };
    const flush = () => {
      if (document.visibilityState === "hidden") {
        if (editorOpenRef.current) {
          dirtyRef.current = true;
          const snap = snapshot();
          lastCaptureRef.current = snap.content;
          postNoteCapture(snap, true);
        }
        void persist({ keepalive: true, force: true });
        publishExit(true);
        return;
      }
      if (dirtyRef.current) return;
      void (async () => {
        const res = await fetch("/api/notes/place", { cache: "no-store" }).catch(() => null);
        if (!res?.ok) return;
        const data = (await res.json()) as { place?: unknown };
        const remote = parseNotesPlace(data.place);
        const local = readPlace();
        if (!remote || remote.ts <= (local?.ts ?? 0)) return;
        writePlace(remote);
        window.location.reload();
      })();
    };
    const onPageHide = () => {
      if (editorOpenRef.current) {
        dirtyRef.current = true;
        const snap = snapshot();
        lastCaptureRef.current = snap.content;
        postNoteCapture(snap, true);
      }
      void persist({ keepalive: true, force: true });
      publishExit(true);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setItems((prev) => mergeNoteLists(props.initial, readOutbox(), prev, savedIdsRef.current));
  }, [props.initial]);

  useEffect(() => {
    let cancelled = false;
    const flushOutbox = async () => {
      const pending = readOutbox().filter(outboxHasText);
      for (const item of pending) {
        if (cancelled) return;
        if (editorOpenRef.current && item.clientKey === clientKeyRef.current) continue;
        postNoteCapture(item);
        const body = {
          title: noteTitleFromContent(item.content) || notePlainPreview(item.title, 8),
          content: item.content,
          pinned: item.pinned,
        };
        try {
          let res = item.id
            ? await fetch(`/api/notes/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              })
            : null;
          if (!res || res.status === 404) {
            res = await fetch("/api/notes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...body, folderId: item.folderId, clientKey: item.clientKey }),
            });
          }
          if (!res.ok || cancelled) continue;
          const saved = (await res.json()) as NoteRow;
          removeOutbox(item.clientKey);
          savedIdsRef.current.add(saved.id);
          commitNote(saved, item.clientKey);
        } catch {
          // Keep the copy on the device and try again next time the app opens.
        }
      }
    };
    const pull = async () => {
      if (document.hidden) return;
      const res = await fetch("/api/notes", { cache: "no-store" }).catch(() => null);
      if (cancelled || !res) return;
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) return;
      const server = (await res.json()) as NoteRow[];
      if (cancelled) return;
      setItems((prev) => mergeNoteLists(server, readOutbox(), prev, savedIdsRef.current));
    };
    let syncing = false;
    const sync = () => {
      if (document.hidden || syncing) return;
      syncing = true;
      void flushOutbox()
        .then(pull)
        .finally(() => {
          syncing = false;
        });
    };
    sync();
    // iOS home-screen apps often resume with pageshow or focus and no visibilitychange.
    const poll = setInterval(sync, NOTES_POLL_MS);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
    };
    // commitNote is stable enough for this mount-only flush: it only touches refs and setItems.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    setFolders(props.folders);
  }, [props.folders]);

  useEffect(() => {
    if (!editorOpen) return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    const sync = () => {
      if (!vv) {
        root.style.setProperty("--notes-kb-inset", "0px");
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--notes-kb-inset", `${Math.round(inset)}px`);
    };
    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      root.style.removeProperty("--notes-kb-inset");
    };
  }, [editorOpen]);

  useEffect(() => {
    if (!editorOpen) return;
    const el = bodyRef.current;
    if (!el) return;
    const onInput = () => onEditorInputRef.current();
    const onFocus = () => {
      try {
        document.execCommand("defaultParagraphSeparator", false, "div");
      } catch {}
    };
    const onCompStart = () => {
      composingRef.current = true;
    };
    const onCompEnd = () => {
      composingRef.current = false;
      if (bodyRef.current) normalizeNoteBlocks(bodyRef.current);
      onEditorInputRef.current();
    };
    const onClick = (e: MouseEvent) => onEditorClickRef.current(e);
    el.addEventListener("input", onInput);
    el.addEventListener("keyup", onInput);
    el.addEventListener("focus", onFocus);
    el.addEventListener("compositionstart", onCompStart);
    el.addEventListener("compositionend", onCompEnd);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keyup", onInput);
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("compositionstart", onCompStart);
      el.removeEventListener("compositionend", onCompEnd);
      el.removeEventListener("click", onClick);
    };
  }, [editorOpen, editingId]);

  useEffect(() => {
    if (!editorOpen) return;
    const scrollY = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [editorOpen]);

  const activeNotes = useMemo(() => items.filter((n) => !n.deletedAt), [items]);
  const trashNotes = useMemo(
    () =>
      items
        .filter((n) => n.deletedAt)
        .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()),
    [items],
  );

  const viewNotes = useMemo(() => {
    if (view.kind === "trash") return trashNotes;
    if (view.kind === "folder") return activeNotes.filter((n) => n.folderId === view.id);
    return activeNotes;
  }, [view, activeNotes, trashNotes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return viewNotes;
    return viewNotes.filter((n) => {
      const preview = notePlainPreview(n.content, 40).toLowerCase();
      return (
        notePlainPreview(n.title, 40).toLowerCase().includes(q) ||
        preview.includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    });
  }, [viewNotes, query]);

  const sections = useMemo(() => groupNotes(filtered), [filtered]);

  function editableRoots() {
    return [bodyRef.current].filter((el): el is HTMLDivElement => Boolean(el));
  }

  function rememberSelection() {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (editableRoots().some((root) => root.contains(range.commonAncestorContainer))) {
      savedRange.current = range.cloneRange();
    }
  }

  function runCommand(cmd: string, value?: string) {
    const range = savedRange.current;
    const root = range
      ? editableRoots().find((el) => el.contains(range.commonAncestorContainer))
      : undefined;
    if (!range || !root) return;
    const sel = document.getSelection();
    const live = sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0) : null;
    if (!live || !root.contains(live.commonAncestorContainer)) {
      root.focus({ preventScroll: true });
    }
    try {
      applyFormat(root, cmd, value, range);
    } catch {
      return;
    }
    rememberSelection();
    markDirty();
  }

  const runCommandRef = useRef(runCommand);
  const rememberRef = useRef(rememberSelection);
  useEffect(() => {
    runCommandRef.current = runCommand;
    rememberRef.current = rememberSelection;
  });

  useEffect(() => {
    if (!editorOpen) return;
    const onSelect = () => rememberRef.current();
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [editorOpen]);

  useEffect(() => {
    const bar = toolbarRef.current;
    if (!toolbarOpen || !bar) return;
    const keepSelection = (e: Event) => {
      rememberRef.current();
      const target = e.target as HTMLElement | null;
      if (!target || target.closest("select, input, textarea, [data-file], [data-link]")) return;
      e.preventDefault();
    };
    let touched = false;
    const runFrom = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cmd]");
      if (!el || !bar.contains(el)) return;
      if (e.type === "click" && touched) {
        touched = false;
        return;
      }
      if (e.type === "touchend") touched = true;
      e.preventDefault();
      runCommandRef.current(el.dataset.cmd ?? "", el.dataset.value);
    };
    bar.addEventListener("touchstart", keepSelection, { passive: false });
    bar.addEventListener("mousedown", keepSelection);
    bar.addEventListener("touchend", runFrom);
    bar.addEventListener("click", runFrom);
    return () => {
      bar.removeEventListener("touchstart", keepSelection);
      bar.removeEventListener("mousedown", keepSelection);
      bar.removeEventListener("touchend", runFrom);
      bar.removeEventListener("click", runFrom);
    };
  }, [toolbarOpen]);

  function resetEditorRefs(id: string | null, pinned: boolean) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    editingIdRef.current = id;
    pinnedRef.current = pinned;
    dirtyRef.current = false;
    queuedRef.current = false;
    pendingFilesRef.current = [];
  }

  function openComposer(opts: {
    id: string | null;
    clientKey?: string;
    pinned: boolean;
    folderId: string | null;
    content: string;
    attachments?: NoteAttachment[];
    focus?: boolean;
    resumeDirty?: boolean;
  }) {
    resetEditorRefs(opts.id, opts.pinned);
    clientKeyRef.current = opts.clientKey || opts.id || newClientKey();
    ackedHtmlRef.current = opts.resumeDirty ? "" : opts.content;
    ackedPinnedRef.current = opts.resumeDirty ? !opts.pinned : opts.pinned;
    lastGoodHtmlRef.current = opts.content;
    userEmptiedRef.current = false;
    newFolderRef.current = opts.folderId;
    setEditingId(opts.id);
    setDraftPinned(opts.pinned);
    setDraftAttachments(opts.attachments ?? []);
    setPendingFiles([]);
    setError(null);
    setToolbarOpen(false);
    setLinkPicker(false);
    setLinkBack([]);
    pendingFill.current = {
      content: opts.content,
      focus: opts.focus,
      resumeDirty: opts.resumeDirty,
      id: opts.id,
    };
    setEditorOpen(true);
  }

  function openCreate() {
    openComposer({
      id: null,
      clientKey: newClientKey(),
      pinned: false,
      folderId: view.kind === "folder" ? view.id : null,
      content: "",
      focus: true,
    });
  }

  function openEdit(note: NoteRow) {
    const pending = readOutbox().find((item) => !item.id && item.clientKey === note.id);
    if (pending) {
      openComposer({
        id: null,
        clientKey: pending.clientKey,
        pinned: pending.pinned,
        folderId: pending.folderId,
        content: pending.content,
        resumeDirty: true,
        focus: true,
      });
      return;
    }
    openComposer({
      id: note.id,
      clientKey: note.id,
      pinned: note.pinned,
      folderId: note.folderId,
      content: textForEditor(note),
      attachments: note.attachments ?? [],
    });
  }

  function liveHtml() {
    return (bodyRef.current?.innerHTML ?? "").trim();
  }

  function liveHasText() {
    const root = bodyRef.current;
    if (!root) return false;
    return htmlHasText(root.innerHTML) || Boolean((root.innerText || "").replace(/\u00a0/g, " ").trim());
  }

  function snapshot(): OutboxItem {
    const live = liveHtml();
    let content = live;
    if (liveHasText()) {
      lastGoodHtmlRef.current = live;
      userEmptiedRef.current = false;
    } else if (!userEmptiedRef.current && htmlHasText(lastGoodHtmlRef.current) && editorOpenRef.current) {
      content = lastGoodHtmlRef.current;
    }
    if (!clientKeyRef.current) clientKeyRef.current = newClientKey();
    return {
      clientKey: clientKeyRef.current,
      id: editingIdRef.current,
      folderId: newFolderRef.current,
      title: noteTitleFromContent(content),
      content,
      pinned: pinnedRef.current,
      ts: Date.now(),
    };
  }

  function captureEditorDom() {
    if (liveHasText()) {
      lastGoodHtmlRef.current = liveHtml();
      userEmptiedRef.current = false;
      return;
    }
    userEmptiedRef.current = true;
    lastGoodHtmlRef.current = "";
  }

  /** Every edit: write to the device right away, save to the server shortly after. */
  function markDirty() {
    dirtyRef.current = true;
    const snap = snapshot();
    if (outboxHasText(snap)) upsertOutbox(snap);
    else if (userEmptiedRef.current) removeOutbox(snap.clientKey);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const latest = snapshot();
      if (outboxHasText(latest) && latest.content !== lastCaptureRef.current) {
        lastCaptureRef.current = latest.content;
        postNoteCapture(latest);
      }
      void persist();
    }, AUTOSAVE_DELAY_MS);
  }

  onEditorInputRef.current = () => {
    if (composingRef.current) return;
    if (bodyRef.current) normalizeNoteBlocks(bodyRef.current);
    captureEditorDom();
    setError(null);
    markDirty();
  };

  function commitNote(row: NoteRow, clientKey?: string) {
    savedIdsRef.current.add(row.id);
    const prevRow = itemsRef.current.find((n) => n.id === row.id);
    const prev = itemsRef.current.filter((n) => n.id !== row.id && n.id !== clientKey);
    const next = sortNotes([
      { ...prevRow, ...row, attachments: row.attachments ?? prevRow?.attachments ?? [] },
      ...prev,
    ]);
    itemsRef.current = next;
    setItems(next);
  }

  async function persist(opts?: { keepalive?: boolean; force?: boolean }): Promise<boolean> {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (discardingRef.current) {
      dirtyRef.current = false;
      return true;
    }
    if (savingRef.current) {
      queuedRef.current = true;
      return false;
    }
    if (!editorOpenRef.current && !dirtyRef.current && !opts?.force) return true;

    const snap = snapshot();
    const hasText = outboxHasText(snap);
    if (hasText && (opts?.force || snap.content !== lastCaptureRef.current)) {
      lastCaptureRef.current = snap.content;
      postNoteCapture(snap, Boolean(opts?.keepalive));
    }
    if (!editorOpenRef.current && !hasText) {
      dirtyRef.current = false;
      return true;
    }
    if (!hasText && !snap.id) {
      dirtyRef.current = false;
      removeOutbox(snap.clientKey);
      setSyncNotice(null);
      return true;
    }
    if (snap.id && snap.content === ackedHtmlRef.current && snap.pinned === ackedPinnedRef.current) {
      dirtyRef.current = false;
      return true;
    }

    dirtyRef.current = false;
    savingRef.current = true;
    upsertOutbox(snap);
    try {
      const payload = JSON.stringify({
        title: snap.title.trim(),
        content: snap.content,
        pinned: snap.pinned,
        ...(snap.id ? {} : { folderId: snap.folderId, clientKey: snap.clientKey }),
      });
      const res = await fetch(snap.id ? `/api/notes/${snap.id}` : "/api/notes", {
        method: snap.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: Boolean(opts?.keepalive) && payload.length < 60_000,
      });
      if (res.status === 404 && snap.id) {
        editingIdRef.current = null;
        setEditingId(null);
        dirtyRef.current = true;
        queuedRef.current = true;
        return false;
      }
      if (!res.ok) throw new Error("save failed");
      const saved = (await res.json()) as NoteRow;
      ackedHtmlRef.current = snap.content;
      ackedPinnedRef.current = snap.pinned;
      if (!snap.id) {
        editingIdRef.current = saved.id;
        setEditingId(saved.id);
      }
      if (dirtyRef.current) upsertOutbox(snapshot());
      else removeOutbox(snap.clientKey);
      commitNote(saved, snap.clientKey);
      if (!dirtyRef.current) setSyncNotice(null);
      void uploadPending();
      return true;
    } catch {
      dirtyRef.current = true;
      upsertOutbox(snap);
      saveTimer.current = setTimeout(() => void persist({ force: true, keepalive: opts?.keepalive }), AUTOSAVE_RETRY_MS);
      return false;
    } finally {
      savingRef.current = false;
      if (!discardingRef.current && queuedRef.current) {
        queuedRef.current = false;
        void persist({ force: true, keepalive: opts?.keepalive });
      }
    }
  }

  function editorIsBlank() {
    const root = bodyRef.current;
    if (!root) return false;
    if (liveHasText()) return false;
    if (!userEmptiedRef.current && htmlHasText(lastGoodHtmlRef.current)) return false;
    return true;
  }

  /** A note with no letters is removed only after leaving it. */
  async function dropBlankNote(): Promise<boolean> {
    const hasFiles = draftAttachments.length > 0 || pendingFilesRef.current.length > 0;
    if (!editorIsBlank() || hasFiles) return false;
    discardingRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    dirtyRef.current = false;
    queuedRef.current = false;
    if (clientKeyRef.current) removeOutbox(clientKeyRef.current);
    const start = Date.now();
    while (savingRef.current && Date.now() - start < 8000) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const id = editingIdRef.current;
    if (id) {
      savedIdsRef.current.delete(id);
      const next = itemsRef.current.filter((n) => n.id !== id);
      itemsRef.current = next;
      setItems(next);
      void fetch(`/api/notes/${id}`, { method: "DELETE", keepalive: true }).catch(() => {});
    }
    discardingRef.current = false;
    resetEditorRefs(null, false);
    setDraftAttachments([]);
    setPendingFiles([]);
    return true;
  }

  async function uploadPending() {
    const noteId = editingIdRef.current;
    const files = pendingFilesRef.current;
    if (!noteId || files.length === 0 || uploadingRef.current) return;
    uploadingRef.current = true;
    try {
      const uploaded = await uploadFilesToNote(noteId, files);
      pendingFilesRef.current = pendingFilesRef.current.filter((f) => !files.includes(f));
      setPendingFiles(pendingFilesRef.current);
      setDraftAttachments((prev) => [...prev, ...uploaded]);
      setItems((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, attachments: [...(n.attachments ?? []), ...uploaded] } : n)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "העלאת קובץ נכשלה");
    } finally {
      uploadingRef.current = false;
    }
  }

  async function refreshSummary(id: string) {
    const res = await fetch(`/api/notes/${id}/summary`, { method: "POST" }).catch(() => null);
    if (!res?.ok) return;
    const { summary } = (await res.json()) as { summary: string };
    setItems((list) => list.map((n) => (n.id === id ? { ...n, summary, summaryStale: false } : n)));
  }

  async function closeEditor() {
    const dropped = await dropBlankNote();
    let synced = true;
    if (!dropped) {
      synced = await saveBeforeLeave();
      if (editingIdRef.current && synced) void refreshSummary(editingIdRef.current);
      if (synced && clientKeyRef.current) removeOutbox(clientKeyRef.current);
    }
    if (synced) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      setSyncNotice(null);
    } else {
      setSyncNotice(SYNC_NOTICE);
      setItems((prev) => mergeNoteLists(prev, readOutbox(), prev, savedIdsRef.current));
    }
    setLinkBack([]);
    setLinkPicker(false);
    setEditorOpen(false);
    setToolbarOpen(false);
  }

  async function saveBeforeLeave() {
    const start = Date.now();
    while (savingRef.current && Date.now() - start < 8000) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    dirtyRef.current = true;
    return persist({ force: true, keepalive: true });
  }

  function insertNoteLink(target: NoteRow) {
    const root = bodyRef.current;
    if (!root) return;
    const labelFromSelection = () => {
      const range = savedRange.current;
      if (!range || range.collapsed || !root.contains(range.commonAncestorContainer)) return "";
      return range.toString().replace(/\s+/g, " ").trim().slice(0, 80);
    };
    const label = labelFromSelection() || "לחץ פה";
    const link = document.createElement("a");
    link.className = "notes-note-link";
    link.dataset.noteLink = target.id;
    link.href = `#note-${target.id}`;
    link.contentEditable = "false";
    link.textContent = label;
    const range = savedRange.current;
    if (range && root.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(link);
      const space = document.createTextNode("\u00a0");
      link.after(space);
    } else {
      root.appendChild(link);
    }
    savedRange.current = null;
    markDirty();
  }

  async function openLinkedNote(targetId: string) {
    if (!targetId || targetId === editingIdRef.current) return;
    const target = itemsRef.current.find((n) => n.id === targetId && !n.deletedAt);
    if (!target) {
      setError("הפתק לא נמצא");
      return;
    }
    const fromTitle = noteTitleFromContent(bodyRef.current?.innerHTML ?? "") || "פתק";
    const saved = await saveBeforeLeave();
    if (!saved) {
      setSyncNotice(SYNC_NOTICE);
      return;
    }
    const fromId = editingIdRef.current;
    if (fromId) setLinkBack((stack) => [...stack, { id: fromId, title: fromTitle }]);
    const fresh = itemsRef.current.find((n) => n.id === targetId && !n.deletedAt) ?? target;
    openEdit(fresh);
  }

  onEditorClickRef.current = (e) => {
    const raw = e.target;
    const el = raw instanceof Element ? raw : raw instanceof Node ? raw.parentElement : null;
    const link = el?.closest<HTMLElement>("[data-note-link]");
    if (!link || !bodyRef.current?.contains(link)) return;
    e.preventDefault();
    const id = link.dataset.noteLink;
    if (id) void openLinkedNote(id);
  };

  async function backToLinkedNote() {
    const prev = linkBack[linkBack.length - 1];
    if (!prev) return;
    const dropped = await dropBlankNote();
    if (!dropped) {
      const saved = await saveBeforeLeave();
      if (!saved) {
        setSyncNotice(SYNC_NOTICE);
        return;
      }
    }
    setLinkBack((stack) => stack.slice(0, -1));
    const note = itemsRef.current.find((n) => n.id === prev.id && !n.deletedAt);
    if (!note) {
      setLinkBack([]);
      setError("הפתק הקודם לא נמצא");
      return;
    }
    openEdit(note);
  }

  async function uploadFilesToNote(noteId: string, files: File[]) {
    const uploaded: NoteAttachment[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/notes/${noteId}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "\u05d4\u05e2\u05dc\u05d0\u05ea \u05e7\u05d5\u05d1\u05e5 \u05e0\u05db\u05e9\u05dc\u05d4");
      }
      uploaded.push((await res.json()) as NoteAttachment);
    }
    return uploaded;
  }

  async function moveNoteTo(note: NoteRow, folderId: string | null) {
    if (editingIdRef.current === note.id) newFolderRef.current = folderId;
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    }).catch(() => null);
    if (!res?.ok) return;
    commitNote((await res.json()) as NoteRow);
    setMoveNote(null);
    setMoveFolderName("");
  }

  async function createFolderForMove() {
    const name = moveFolderName.trim();
    const note = moveNote;
    if (!name || !note) return;
    const res = await fetch("/api/notes/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (!res?.ok) return;
    const folder = (await res.json()) as NoteFolderRow;
    setFolders((list) => [...list, folder]);
    await moveNoteTo(note, folder.id);
  }

  async function togglePin(note: NoteRow, e?: React.MouseEvent) {
    e?.stopPropagation();
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as NoteRow;
    setItems((prev) => sortNotes(prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))));
  }

  /** Moves the note to "Recently Deleted". */
  async function trashNote(id: string) {
    if (editingIdRef.current === id) {
      await persist({ force: true });
      resetEditorRefs(null, false);
      if (clientKeyRef.current) removeOutbox(clientKeyRef.current);
      setLinkBack([]);
      setLinkPicker(false);
      setEditorOpen(false);
      setToolbarOpen(false);
    }
    const prev = items.find((n) => n.id === id);
    setItems((list) => list.map((n) => (n.id === id ? { ...n, deletedAt: new Date().toISOString() } : n)));
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted: true }),
    }).catch(() => null);
    if (res?.ok) commitNote((await res.json()) as NoteRow);
    else if (prev) setItems((list) => list.map((n) => (n.id === id ? prev : n)));
  }

  async function restoreNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted: false }),
    }).catch(() => null);
    if (res?.ok) commitNote((await res.json()) as NoteRow);
  }

  async function purgeNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setItems((list) => list.filter((n) => n.id !== id));
  }

  async function purgeAll() {
    if (!confirm(`למחוק סופית ${trashNotes.length} פתקים? אי אפשר לשחזר.`)) return;
    for (const n of trashNotes) await purgeNote(n.id);
  }

  async function duplicateNote(id: string) {
    const res = await fetch(`/api/notes/${id}/duplicate`, { method: "POST" }).catch(() => null);
    if (res?.ok) commitNote((await res.json()) as NoteRow);
  }

  async function saveFolder() {
    if (!folderDialog) return;
    const name = folderDialog.name.trim();
    if (!name) return;
    const { id } = folderDialog;
    setFolderDialog(null);
    const res = await fetch(id ? `/api/notes/folders/${id}` : "/api/notes/folders", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (!res?.ok) return;
    const row = (await res.json()) as NoteFolderRow;
    setFolders((list) => (id ? list.map((f) => (f.id === id ? row : f)) : [...list, row]));
  }

  async function deleteFolder(folder: NoteFolderRow) {
    const count = activeNotes.filter((n) => n.folderId === folder.id).length;
    const msg = count
      ? `למחוק את התיקייה "${folder.name}"? ${count} הפתקים שבה יעברו לנמחקו לאחרונה.`
      : `למחוק את התיקייה "${folder.name}"?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/notes/folders/${folder.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return;
    const { deletedAt } = (await res.json()) as { deletedAt: string };
    setFolders((list) => list.filter((f) => f.id !== folder.id));
    setItems((list) =>
      list.map((n) => (n.folderId === folder.id ? { ...n, folderId: null, deletedAt: n.deletedAt ?? deletedAt } : n)),
    );
    if (view.kind === "folder" && view.id === folder.id) setView({ kind: "folders" });
  }

  function noteTitle(note: NoteRow) {
    return noteTitleFromContent(note.content) || notePlainPreview(note.title, 8) || "פתק חדש";
  }

  function noteTitleHtml(note: NoteRow) {
    if (noteTitleFromContent(note.content)) return null;
    if (!notePlainPreview(note.title, 40) || !looksLikeHtml(note.title)) return null;
    return sanitizeNoteHtml(note.title);
  }

  function noteSummary(note: NoteRow) {
    const text = note.summary || notePlainPreview(note.content, 8);
    return text && text !== noteTitle(note) ? text : "";
  }

  function openNoteMenu(note: NoteRow, anchor: DOMRect) {
    const title = noteTitle(note);
    if (note.deletedAt) {
      setMenu({
        anchor,
        title,
        items: [
          { label: "שחזר", icon: IconRefresh, onSelect: () => void restoreNote(note.id) },
          {
            label: "מחק לצמיתות",
            icon: IconTrash,
            danger: true,
            onSelect: () => {
              if (confirm("למחוק סופית? אי אפשר לשחזר.")) void purgeNote(note.id);
            },
          },
        ],
      });
      return;
    }
    setMenu({
      anchor,
      title,
      items: [
        {
          label: note.pinned ? "בטל נעיצה" : "נעץ",
          icon: IconStar,
          onSelect: () => void togglePin(note),
        },
        { label: "העבר לתיקייה", icon: IconFolder, onSelect: () => setMoveNote(note) },
        { label: "שכפל", icon: IconCopy, onSelect: () => void duplicateNote(note.id) },
        { label: "מחק", icon: IconTrash, danger: true, onSelect: () => void trashNote(note.id) },
      ],
    });
  }

  function openFolderMenu(folder: NoteFolderRow, anchor: DOMRect) {
    setMenu({
      anchor,
      title: folder.name,
      items: [
        { label: "שנה שם", icon: IconPencil, onSelect: () => setFolderDialog({ id: folder.id, name: folder.name }) },
        { label: "מחק תיקייה", icon: IconTrash, danger: true, onSelect: () => void deleteFolder(folder) },
      ],
    });
  }

  async function removeAttachment(attachmentId: string) {
    if (!editingId) {
      setDraftAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      return;
    }
    const res = await fetch(`/api/notes/${editingId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setDraftAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    setItems((prev) =>
      prev.map((n) =>
        n.id === editingId
          ? { ...n, attachments: (n.attachments ?? []).filter((a) => a.id !== attachmentId) }
          : n,
      ),
    );
  }

  function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    pendingFilesRef.current = [...pendingFilesRef.current, ...Array.from(files)].slice(0, 12);
    setPendingFiles(pendingFilesRef.current);
    if (editingIdRef.current) void uploadPending();
    else markDirty();
  }


  const reader = editorOpen ? (
    <div className="notes-reader" role="dialog" aria-modal="true" aria-label={editingId ? "עריכת פתק" : "פתק חדש"}>
      <header className="notes-reader-top">
        <button
          type="button"
          className="notes-reader-back"
          onClick={() => void (linkBack.length ? backToLinkedNote() : closeEditor())}
        >
          {linkBack.length ? `← ${linkBack[linkBack.length - 1]?.title || "פתק"}` : "← פתקים"}
        </button>
        <div className="notes-reader-actions">
          <button
            type="button"
            className={`notes-reader-icon${draftPinned ? " is-on" : ""}`}
            onClick={() => {
              pinnedRef.current = !pinnedRef.current;
              setDraftPinned(pinnedRef.current);
              markDirty();
            }}
            aria-label={draftPinned ? "\u05d1\u05d8\u05dc \u05e0\u05e2\u05d9\u05e6\u05d4" : "\u05e0\u05e2\u05e5"}
          >
            {draftPinned ? "\u2605" : "\u2606"}
          </button>
          <button
            type="button"
            className="notes-reader-icon"
            aria-label="העבר לתיקייה"
            onClick={() => {
              const current = editingId ? itemsRef.current.find((n) => n.id === editingId) : null;
              if (current) {
                setMoveNote(current);
                return;
              }
              void (async () => {
                const ok = await saveBeforeLeave();
                if (!ok) {
                  setSyncNotice(SYNC_NOTICE);
                  return;
                }
                const id = editingIdRef.current;
                const fresh = id ? itemsRef.current.find((n) => n.id === id) : null;
                if (fresh) setMoveNote(fresh);
              })();
            }}
          >
            <IconFolder className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={`notes-reader-icon${toolbarOpen ? " is-on" : ""}`}
            onClick={() => setToolbarOpen((v) => !v)}
            aria-label="\u05e2\u05d9\u05e6\u05d5\u05d1"
          >
            Aa
          </button>
          {editingId ? (
            <button
              type="button"
              className="notes-reader-danger"
              onClick={() => void trashNote(editingId)}
            >
              {"\u05de\u05d7\u05e7"}
            </button>
          ) : null}
        </div>
      </header>
      {syncNotice ? (
        <p className="notes-reader-sync" role="status">
          {syncNotice}
        </p>
      ) : null}

      {toolbarOpen ? (
        <div ref={toolbarRef} className="notes-rich-toolbar notes-rich-toolbar--reader" role="toolbar" aria-label="עיצוב טקסט">
          <button type="button" className="notes-rich-btn" data-cmd="bold" aria-label="הדגשה">
            <strong>B</strong>
          </button>
          <button type="button" className="notes-rich-btn" data-cmd="italic" aria-label="הטיה">
            <em>I</em>
          </button>
          <button type="button" className="notes-rich-btn" data-cmd="underline" aria-label="קו תחתון">
            <span className="notes-u">U</span>
          </button>
          <button type="button" className="notes-rich-btn" data-cmd="strikeThrough" aria-label="קו חוצה">
            <span className="notes-s">S</span>
          </button>
          <span className="notes-rich-sep" />
          <select
            className="notes-rich-select"
            defaultValue="4"
            aria-label="גודל גופן"
            onChange={(e) => runCommand("fontSize", e.target.value)}
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="notes-rich-sep" />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="notes-swatch"
              style={{ background: c }}
              data-cmd="foreColor"
              data-value={c}
              aria-label="צבע טקסט"
            />
          ))}
          <span className="notes-rich-sep" />
          {HIGHLIGHTS.map((c) => (
            <button
              key={c}
              type="button"
              className="notes-swatch notes-swatch--hl"
              style={{ background: c === "transparent" ? "#fff" : c }}
              data-cmd="hiliteColor"
              data-value={c === "transparent" ? "transparent" : c}
              aria-label="צבע רקע"
            />
          ))}
          <span className="notes-rich-sep" />
          <button
            type="button"
            className="notes-rich-btn notes-rich-btn--link"
            data-link="1"
            aria-label="קישור לפתק"
            onPointerDown={() => rememberRef.current()}
            onClick={() => {
              setLinkQuery("");
              setLinkPicker(true);
            }}
          >
            קישור
          </button>
          <button type="button" className="notes-rich-btn" data-file="1" onClick={() => fileRef.current?.click()} aria-label="צרף קובץ">
            {"📎"}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            multiple
            accept="image/*,.pdf,.txt,.doc,.docx,application/pdf"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="notes-reader-scroll"
        onPointerDown={(e) => {
          const root = bodyRef.current;
          if (!root) return;
          const raw = e.target;
          if (!(raw instanceof Node)) return;
          if (raw instanceof Element && raw.closest("a, button, input, textarea, [data-note-link]")) return;
          const inText = raw !== root && raw !== scrollRef.current && root.contains(raw);
          if (inText) return;
          e.preventDefault();
          placeCaretInNote(root, e.clientX, e.clientY);
        }}
      >
        <NoteSurface mount={mountBody} />


        {(draftAttachments.length > 0 || pendingFiles.length > 0) && (
          <ul className="notes-attach-list">
            {draftAttachments.map((a) => (
              <li key={a.id} className="notes-attach-item">
                {a.url && a.fileMime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" className="notes-attach-thumb" />
                ) : (
                  <span className="notes-attach-file">{"📄"}</span>
                )}
                <div className="min-w-0 flex-1">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="notes-attach-name">
                      {a.fileName}
                    </a>
                  ) : (
                    <span className="notes-attach-name">{a.fileName}</span>
                  )}
                  <div className="notes-attach-meta">{formatSize(a.fileSize)}</div>
                </div>
                <button type="button" className="notes-attach-remove" onClick={() => void removeAttachment(a.id)}>
                  {"\u05d4\u05e1\u05e8"}
                </button>
              </li>
            ))}

            {pendingFiles.map((f, i) => (
              <li key={`pending-${f.name}-${i}`} className="notes-attach-item">
                <span className="notes-attach-file">{"⬆"}</span>
                <div className="min-w-0 flex-1">
                  <span className="notes-attach-name">{f.name}</span>
                  <div className="notes-attach-meta">
                    {editingId ? "מעלה…" : "יעלה כשתכתוב משהו"} · {formatSize(f.size)}
                  </div>
                </div>
                <button
                  type="button"
                  className="notes-attach-remove"
                  onClick={() => {
                    pendingFilesRef.current = pendingFilesRef.current.filter((_, idx) => idx !== i);
                    setPendingFiles(pendingFilesRef.current);
                  }}
                >
                  {"הסר"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error ? <p className="notes-error">{error}</p> : null}
      </div>
      {linkPicker ? (
        <div className="notes-link-picker" role="dialog" aria-label="קישור לפתק">
          <div className="notes-link-bar">
            <button type="button" className="notes-reader-back" onClick={() => setLinkPicker(false)}>
              ביטול
            </button>
            <h2 className="notes-link-title">בחר פתק</h2>
          </div>
          <p className="notes-link-hint">אם סימנת מילים, הן יהיו הקישור. בלי סימון יופיע ״לחץ פה״.</p>
          <input
            className="notes-link-search"
            value={linkQuery}
            onChange={(e) => setLinkQuery(e.target.value)}
            placeholder="חיפוש פתק"
            aria-label="חיפוש פתק"
            enterKeyHint="search"
          />
          <ul className="notes-link-list">
            {activeNotes
              .filter((n) => n.id !== editingId)
              .filter((n) => {
                const q = linkQuery.trim().toLowerCase();
                if (!q) return true;
                return noteTitle(n).toLowerCase().includes(q) || notePlainPreview(n.content, 40).toLowerCase().includes(q);
              })
              .map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="notes-link-row"
                    onClick={() => {
                      insertNoteLink(n);
                      setLinkPicker(false);
                    }}
                  >
                    <span className="notes-link-row-title">{noteTitle(n)}</span>
                    {noteSummary(n) ? <span className="notes-link-row-sum">{noteSummary(n)}</span> : null}
                  </button>
                </li>
              ))}
          </ul>
          {activeNotes.filter((n) => n.id !== editingId).length === 0 ? (
            <p className="notes-link-empty">אין עוד פתק לקשר אליו. צור פתק נוסף, ואז אפשר לחבר אליו.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;


  const viewTitle =
    view.kind === "trash"
      ? "נמחקו לאחרונה"
      : view.kind === "folder"
        ? (folders.find((f) => f.id === view.id)?.name ?? "תיקייה")
        : "פתקים";

  const folderScreen = (
    <div className="notes-app">
      <div className="notes-nav-bar">
        <h1 className="notes-nav-title">{"תיקיות"}</h1>
        <button
          type="button"
          className="notes-nav-icon"
          onClick={() => setFolderDialog({ id: null, name: "" })}
          aria-label={"תיקייה חדשה"}
        >
          <IconFolderPlus className="h-5.5 w-5.5" />
        </button>
      </div>

      <div className="notes-folders">
        <ul className="notes-folder-group">
          <li>
            <PressableRow className="notes-folder-row" onTap={() => setView({ kind: "all" })}>
              <IconNotes className="notes-folder-icon" />
              <span className="notes-folder-name">{"כל הפתקים"}</span>
              <span className="notes-folder-count">{activeNotes.length}</span>
              <IconChevronLeft className="notes-folder-chevron" />
            </PressableRow>
          </li>
          {folders.map((f) => (
            <li key={f.id}>
              <PressableRow
                className="notes-folder-row"
                onTap={() => setView({ kind: "folder", id: f.id })}
                onLongPress={(rect) => openFolderMenu(f, rect)}
              >
                <IconFolder className="notes-folder-icon" />
                <span className="notes-folder-name">{f.name}</span>
                <span className="notes-folder-count">{activeNotes.filter((n) => n.folderId === f.id).length}</span>
                <IconChevronLeft className="notes-folder-chevron" />
              </PressableRow>
            </li>
          ))}
          <li>
            <PressableRow className="notes-folder-row" onTap={() => setView({ kind: "trash" })}>
              <IconTrash className="notes-folder-icon" />
              <span className="notes-folder-name">{"נמחקו לאחרונה"}</span>
              <span className="notes-folder-count">{trashNotes.length}</span>
              <IconChevronLeft className="notes-folder-chevron" />
            </PressableRow>
          </li>
        </ul>
        <p className="notes-folders-hint">{"לחיצה ארוכה על תיקייה כדי לשנות שם או למחוק"}</p>
      </div>
    </div>
  );

  const listScreen = (
    <div className="notes-app">
      <div className="notes-nav-bar">
        <button type="button" className="notes-nav-back" onClick={() => setView({ kind: "folders" })}>
          <IconChevronRight className="h-5 w-5" />
          <span>{"תיקיות"}</span>
        </button>
        {view.kind === "trash" && trashNotes.length > 0 ? (
          <button type="button" className="notes-nav-text is-danger" onClick={() => void purgeAll()}>
            {"מחק הכל"}
          </button>
        ) : null}
      </div>
      <h1 className="notes-view-title">{viewTitle}</h1>
      {syncNotice ? (
        <div className="notes-sync-note" role="status">
          <p>{syncNotice}</p>
          <button type="button" onClick={() => setSyncNotice(null)} aria-label="הבנתי">
            ×
          </button>
        </div>
      ) : null}

      <div className="notes-app-toolbar">
        <div className="notes-search-wrap">
          <span className="notes-search-icon" aria-hidden>
            {"⌕"}
          </span>
          <input
            className="notes-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={"חיפוש"}
            aria-label={"חיפוש בפתקים"}
          />
        </div>
        {view.kind !== "trash" ? (
          <button type="button" className="notes-compose-btn" onClick={openCreate} aria-label={"פתק חדש"}>
            <span aria-hidden>{"✎"}</span>
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="notes-empty-sheet">
          <p className="notes-empty-title">
            {viewNotes.length > 0 ? "אין תוצאות" : view.kind === "trash" ? "אין פתקים שנמחקו" : "אין פתקים עדיין"}
          </p>
          <p className="notes-empty-sub">
            {viewNotes.length > 0
              ? "נסה חיפוש אחר."
              : view.kind === "trash"
                ? "פתקים שתמחק יופיעו כאן עד שתמחק אותם סופית."
                : "לחץ על העיפרון כדי לכתוב פתק חדש."}
          </p>
        </div>
      ) : view.kind === "trash" ? (
        <div className="notes-sections">
          <p className="notes-folders-hint">{"לחיצה על פתק כדי לשחזר או למחוק סופית"}</p>
          <ul className="notes-card-list">
            {filtered.map((note) => (
              <li key={note.id}>
                <PressableRow
                  className="notes-card"
                  onTap={(rect) => openNoteMenu(note, rect)}
                  onLongPress={(rect) => openNoteMenu(note, rect)}
                >
                  <div className="notes-card-main">
                    <h3 className="notes-card-title">
                      {noteTitleHtml(note) ? (
                        <span className="notes-card-title-rich" dangerouslySetInnerHTML={{ __html: noteTitleHtml(note)! }} />
                      ) : (
                        noteTitle(note)
                      )}
                    </h3>
                    {noteSummary(note) ? <p className="notes-card-snippet">{noteSummary(note)}</p> : null}
                  </div>
                </PressableRow>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="notes-sections">
          {sections.map((section) => {
            const isPinned = section.key === "pinned";
            const collapsed = isPinned && pinnedCollapsed;
            return (
              <section key={section.key} className="notes-section">
                <button
                  type="button"
                  className={`notes-section-head${isPinned ? " notes-section-head--pinned" : ""}`}
                  onClick={() => {
                    if (isPinned) setPinnedCollapsed((v) => !v);
                  }}
                  aria-expanded={isPinned ? !collapsed : undefined}
                >
                  {isPinned ? (
                    <span className={`notes-section-chevron${collapsed ? " is-collapsed" : ""}`} aria-hidden>
                      {"▾"}
                    </span>
                  ) : null}
                  <h2 className="notes-section-title">{section.label}</h2>
                </button>
                {!collapsed ? (
                  <ul className="notes-card-list">
                    {section.notes.map((note) => (
                      <li key={note.id}>
                        <PressableRow
                          className="notes-card"
                          onTap={() => openEdit(note)}
                          onLongPress={(rect) => openNoteMenu(note, rect)}
                        >
                          <div className="notes-card-main">
                            <h3 className="notes-card-title">
                              {noteTitleHtml(note) ? (
                                <span className="notes-card-title-rich" dangerouslySetInnerHTML={{ __html: noteTitleHtml(note)! }} />
                              ) : (
                                noteTitle(note)
                              )}
                            </h3>
                            {noteSummary(note) ? <p className="notes-card-snippet">{noteSummary(note)}</p> : null}
                          </div>
                          <button
                            type="button"
                            className={`notes-card-pin${note.pinned ? " is-on" : ""}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => void togglePin(note, e)}
                            aria-label={note.pinned ? "בטל נעיצה" : "נעץ"}
                          >
                            {note.pinned ? "★" : "☆"}
                          </button>
                        </PressableRow>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {view.kind === "folders" ? folderScreen : listScreen}

      <AppModal
        open={folderDialog !== null}
        onClose={() => setFolderDialog(null)}
        title={folderDialog?.id ? "שינוי שם תיקייה" : "תיקייה חדשה"}
      >
        <form
          className="notes-folder-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveFolder();
          }}
        >
          <input
            className="notes-folder-input"
            value={folderDialog?.name ?? ""}
            onChange={(e) => setFolderDialog((d) => (d ? { ...d, name: e.target.value } : d))}
            placeholder={"שם התיקייה"}
            maxLength={80}
            autoFocus
          />
          <button type="submit" className="notes-folder-submit" disabled={!folderDialog?.name.trim()}>
            {folderDialog?.id ? "שמור" : "צור תיקייה"}
          </button>
        </form>
      </AppModal>

      {mounted && menu
        ? createPortal(<PressMenu {...menu} onClose={() => setMenu(null)} />, document.body)
        : null}
      {mounted && moveNote
        ? createPortal(
            <div className="notes-move" role="dialog" aria-label="העבר לתיקייה">
              <div className="notes-link-bar">
                <button type="button" className="notes-reader-back" onClick={() => setMoveNote(null)}>
                  ביטול
                </button>
                <h2 className="notes-link-title">העבר לתיקייה</h2>
              </div>
              <p className="notes-link-hint">{noteTitle(moveNote)}</p>
              <ul className="notes-link-list">
                <li>
                  <button
                    type="button"
                    className="notes-link-row"
                    onClick={() => void moveNoteTo(moveNote, null)}
                  >
                    <span className="notes-link-row-title">בלי תיקייה</span>
                    {!moveNote.folderId ? <IconCheck className="h-5 w-5" /> : null}
                  </button>
                </li>
                {folders.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="notes-link-row" onClick={() => void moveNoteTo(moveNote, f.id)}>
                      <span className="notes-link-row-title">{f.name}</span>
                      {moveNote.folderId === f.id ? <IconCheck className="h-5 w-5" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="notes-move-new"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createFolderForMove();
                }}
              >
                <input
                  className="notes-link-search"
                  value={moveFolderName}
                  onChange={(e) => setMoveFolderName(e.target.value)}
                  placeholder="תיקייה חדשה"
                  maxLength={80}
                  aria-label="תיקייה חדשה"
                />
                <button type="submit" className="notes-move-add" disabled={!moveFolderName.trim()}>
                  צור והעבר
                </button>
              </form>
            </div>,
            document.body,
          )
        : null}
      {mounted && reader ? createPortal(reader, document.body) : null}
    </>
  );
}
