"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ReminderDto,
  ReminderListDto,
  ReminderSectionDto,
  RemindersData,
} from "@/app/lib/reminders/types";

const PATCH_DELAY_MS = 450;
const UNDO_MS = 5000;

export type UndoEntry = { id: number; label: string; run: () => void };

type ReminderPatch = Partial<Omit<ReminderDto, "id" | "createdAt" | "completed" | "completedAt">>;

async function send<T>(url: string, method: string, body?: unknown, keepalive?: boolean): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  return (await res.json()) as T;
}

function uuid() {
  return crypto.randomUUID();
}

export function useRemindersStore(initial: RemindersData) {
  const [lists, setLists] = useState<ReminderListDto[]>(initial.lists);
  const [sections, setSections] = useState<ReminderSectionDto[]>(initial.sections);
  const [reminders, setReminders] = useState<ReminderDto[]>(initial.reminders);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remindersRef = useRef(reminders);
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);
  const pending = useRef(new Map<string, ReminderPatch>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fail() {
    setError("לא הצלחתי לשמור. בודק חיבור…");
    setTimeout(() => setError(null), 3500);
  }

  function offerUndo(label: string, run: () => void) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const entry = { id: Date.now(), label, run };
    setUndo(entry);
    undoTimer.current = setTimeout(() => setUndo((u) => (u?.id === entry.id ? null : u)), UNDO_MS);
  }

  function runUndo() {
    if (!undo) return;
    undo.run();
    setUndo(null);
  }

  function flush(id: string, keepalive = false) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    const patch = pending.current.get(id);
    if (!patch) return;
    pending.current.delete(id);
    void send(`/api/reminders/items/${id}`, "PATCH", patch, keepalive).catch(fail);
  }

  function flushAll(keepalive = false) {
    for (const id of [...pending.current.keys()]) flush(id, keepalive);
  }

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  });

  // ─── Reminders ─────────────────────────────────────────────────────────────

  function nextPosition(listId: string, parentId: string | null) {
    const sib = remindersRef.current.filter((r) => r.listId === listId && r.parentId === parentId);
    return sib.reduce((m, r) => Math.max(m, r.position), 0) + 1;
  }

  function createReminder(input: Partial<ReminderDto> & { listId: string; title: string }) {
    const row: ReminderDto = {
      sectionId: null,
      parentId: null,
      notes: "",
      url: "",
      dueDate: null,
      dueTime: null,
      earlyMinutes: null,
      recurrence: null,
      priority: 0,
      flagged: false,
      tags: [],
      completed: false,
      completedAt: null,
      position: nextPosition(input.listId, input.parentId ?? null),
      ...input,
      id: input.id || uuid(),
      createdAt: new Date().toISOString(),
    };
    remindersRef.current = [...remindersRef.current, row];
    setReminders((prev) => [...prev, row]);
    const { completed: _c, completedAt: _ca, createdAt: _cr, ...body } = row;
    void send("/api/reminders/items", "POST", body).catch(() => {
      setReminders((prev) => prev.filter((r) => r.id !== row.id));
      fail();
    });
    return row;
  }

  function updateReminder(id: string, patch: ReminderPatch) {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (patch.listId) {
      setReminders((prev) =>
        prev.map((r) => (r.parentId === id ? { ...r, listId: patch.listId!, sectionId: patch.sectionId ?? null } : r)),
      );
    }
    pending.current.set(id, { ...pending.current.get(id), ...patch });
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.set(id, setTimeout(() => flush(id), PATCH_DELAY_MS));
  }

  function toggleComplete(id: string) {
    const r = remindersRef.current.find((x) => x.id === id);
    if (!r) return;
    flush(id);
    const completed = !r.completed;
    const before = r;
    setReminders((prev) =>
      prev.map((x) => (x.id === id ? { ...x, completed, completedAt: completed ? new Date().toISOString() : null } : x)),
    );
    void send<{ reminder: ReminderDto; advanced: boolean }>(`/api/reminders/items/${id}/toggle`, "POST", { completed })
      .then(({ reminder, advanced }) => {
        setReminders((prev) =>
          prev.map((x) =>
            x.id === id ? reminder : advanced && x.parentId === id ? { ...x, completed: false, completedAt: null } : x,
          ),
        );
        if (completed) {
          offerUndo(advanced ? "הועבר למועד הבא" : "סומן כבוצע", () => {
            setReminders((prev) => prev.map((x) => (x.id === id ? before : x)));
            void send(`/api/reminders/items/${id}/toggle`, "POST", { completed: false })
              .then(() =>
                advanced
                  ? send(`/api/reminders/items/${id}`, "PATCH", { dueDate: before.dueDate, recurrence: before.recurrence })
                  : null,
              )
              .catch(fail);
          });
        }
      })
      .catch(() => {
        setReminders((prev) => prev.map((x) => (x.id === id ? before : x)));
        fail();
      });
  }

  function deleteReminder(id: string) {
    flush(id);
    const removed = remindersRef.current.filter((r) => r.id === id || r.parentId === id);
    setReminders((prev) => prev.filter((r) => r.id !== id && r.parentId !== id));
    void send(`/api/reminders/items/${id}`, "PATCH", { deleted: true }).catch(fail);
    offerUndo("התזכורת נמחקה", () => {
      setReminders((prev) => [...prev, ...removed]);
      void send(`/api/reminders/items/${id}`, "PATCH", { deleted: false }).catch(fail);
    });
  }

  function duplicateReminder(id: string) {
    const r = remindersRef.current.find((x) => x.id === id);
    if (!r) return;
    const copy = createReminder({ ...r, id: undefined as unknown as string, completed: false, completedAt: null, position: r.position + 0.01 });
    for (const sub of remindersRef.current.filter((x) => x.parentId === id)) {
      createReminder({ ...sub, id: undefined as unknown as string, parentId: copy.id, completed: false, completedAt: null });
    }
  }

  /** Make `id` a subtask of the reminder right above it among its siblings. */
  function indent(id: string, ordered: ReminderDto[]) {
    const r = remindersRef.current.find((x) => x.id === id);
    if (!r || r.parentId) return;
    const tops = ordered.filter((x) => !x.parentId && x.listId === r.listId);
    const idx = tops.findIndex((x) => x.id === id);
    const above = idx > 0 ? tops[idx - 1] : null;
    if (!above) return;
    if (remindersRef.current.some((x) => x.parentId === id)) {
      for (const sub of remindersRef.current.filter((x) => x.parentId === id)) updateReminder(sub.id, { parentId: above.id });
    }
    updateReminder(id, { parentId: above.id, position: nextPosition(r.listId, above.id) });
  }

  function outdent(id: string) {
    const r = remindersRef.current.find((x) => x.id === id);
    if (!r?.parentId) return;
    const parent = remindersRef.current.find((x) => x.id === r.parentId);
    updateReminder(id, { parentId: null, position: (parent?.position ?? 0) + 0.5, sectionId: parent?.sectionId ?? null });
  }

  function clearCompleted(listId: string) {
    const done = remindersRef.current.filter((r) => r.listId === listId && r.completed);
    if (done.length === 0) return;
    const ids = new Set(done.map((r) => r.id));
    setReminders((prev) => prev.filter((r) => !ids.has(r.id)));
    void send(`/api/reminders/lists/${listId}/clear-completed`, "POST").catch(fail);
    offerUndo(`נמחקו ${done.length} שהושלמו`, () => {
      setReminders((prev) => [...prev, ...done]);
      for (const r of done) void send(`/api/reminders/items/${r.id}`, "PATCH", { deleted: false }).catch(fail);
    });
  }

  // ─── Lists & sections ──────────────────────────────────────────────────────

  async function createList(input: Pick<ReminderListDto, "name" | "color" | "icon" | "kind">) {
    const id = uuid();
    const optimistic: ReminderListDto = {
      ...input,
      id,
      sortMode: "manual",
      showCompleted: false,
      viewMode: "list",
      position: lists.reduce((m, l) => Math.max(m, l.position), 0) + 1,
    };
    setLists((prev) => [...prev, optimistic]);
    try {
      const row = await send<ReminderListDto>("/api/reminders/lists", "POST", { ...input, id });
      setLists((prev) => prev.map((l) => (l.id === id ? row : l)));
    } catch {
      setLists((prev) => prev.filter((l) => l.id !== id));
      fail();
    }
    return id;
  }

  function updateList(id: string, patch: Partial<Omit<ReminderListDto, "id">>) {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    void send(`/api/reminders/lists/${id}`, "PATCH", patch).catch(fail);
  }

  function deleteList(id: string) {
    setLists((prev) => prev.filter((l) => l.id !== id));
    setSections((prev) => prev.filter((s) => s.listId !== id));
    setReminders((prev) => prev.filter((r) => r.listId !== id));
    void send(`/api/reminders/lists/${id}`, "DELETE").catch(fail);
  }

  function createSection(listId: string, name: string) {
    const id = uuid();
    const position = sections.filter((s) => s.listId === listId).reduce((m, s) => Math.max(m, s.position), 0) + 1;
    setSections((prev) => [...prev, { id, listId, name, position }]);
    void send("/api/reminders/sections", "POST", { id, listId, name, position }).catch(() => {
      setSections((prev) => prev.filter((s) => s.id !== id));
      fail();
    });
    return id;
  }

  function renameSection(id: string, name: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    void send(`/api/reminders/sections/${id}`, "PATCH", { name }).catch(fail);
  }

  function deleteSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setReminders((prev) => prev.map((r) => (r.sectionId === id ? { ...r, sectionId: null } : r)));
    void send(`/api/reminders/sections/${id}`, "DELETE").catch(fail);
  }

  return {
    lists,
    sections,
    reminders,
    undo,
    error,
    runUndo,
    dismissUndo: () => setUndo(null),
    createReminder,
    updateReminder,
    toggleComplete,
    deleteReminder,
    duplicateReminder,
    indent,
    outdent,
    clearCompleted,
    createList,
    updateList,
    deleteList,
    createSection,
    renameSection,
    deleteSection,
    flushAll,
  };
}

export type RemindersStore = ReturnType<typeof useRemindersStore>;
