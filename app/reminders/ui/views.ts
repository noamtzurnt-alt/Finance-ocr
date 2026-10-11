import { formatDayHeading, isOverdue, todayIso } from "@/app/lib/reminders/dates";
import { AISLE_ORDER, aisleFor } from "@/app/lib/reminders/groceries";
import type { ReminderDto, ReminderListDto, ReminderSectionDto, SortMode } from "@/app/lib/reminders/types";

export type SmartId = "today" | "scheduled" | "all" | "flagged" | "completed";

export type Screen =
  | { kind: "home" }
  | { kind: "list"; id: string }
  | { kind: "smart"; id: SmartId }
  | { kind: "tag"; tag: string };

export type Group = {
  key: string;
  title?: string;
  tone?: "danger";
  /** Real section id when the group is a list section (null = "no section"). */
  sectionId?: string | null;
  items: ReminderDto[];
};

export const SMART: Record<SmartId, { title: string; color: string }> = {
  today: { title: "היום", color: "#0a84ff" },
  scheduled: { title: "מתוכנן", color: "#ff453a" },
  all: { title: "הכל", color: "#8e8e93" },
  flagged: { title: "מסומן בדגל", color: "#ff9f0a" },
  completed: { title: "הושלמו", color: "#8e8e93" },
};

function dueKey(r: ReminderDto) {
  return `${r.dueDate ?? "9999-99-99"} ${r.dueTime ?? "99:99"}`;
}

export function sortItems(items: ReminderDto[], mode: SortMode) {
  const list = [...items];
  if (mode === "due") list.sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || a.position - b.position);
  else if (mode === "priority") list.sort((a, b) => b.priority - a.priority || a.position - b.position);
  else if (mode === "created") list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (mode === "title") list.sort((a, b) => a.title.localeCompare(b.title, "he"));
  else list.sort((a, b) => a.position - b.position);
  return list;
}

export function smartMatches(id: SmartId, r: ReminderDto, today = todayIso()) {
  if (id === "completed") return r.completed;
  if (r.completed) return false;
  if (id === "today") return Boolean(r.dueDate && r.dueDate <= today);
  if (id === "scheduled") return Boolean(r.dueDate);
  if (id === "flagged") return r.flagged;
  return true;
}

export function smartCounts(reminders: ReminderDto[]) {
  const today = todayIso();
  const out = { today: 0, scheduled: 0, all: 0, flagged: 0, completed: 0 } as Record<SmartId, number>;
  for (const r of reminders) {
    for (const id of Object.keys(out) as SmartId[]) if (smartMatches(id, r, today)) out[id] += 1;
  }
  return out;
}

export function allTags(reminders: ReminderDto[]) {
  const counts = new Map<string, number>();
  for (const r of reminders) if (!r.completed) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he")).map(([t]) => t);
}

function byList(items: ReminderDto[], lists: ReminderListDto[]): Group[] {
  return lists
    .map((l) => ({ key: l.id, title: l.name, items: items.filter((r) => r.listId === l.id) }))
    .filter((g) => g.items.length > 0);
}

export function buildGroups(opts: {
  screen: Screen;
  lists: ReminderListDto[];
  sections: ReminderSectionDto[];
  reminders: ReminderDto[];
  /** Completed items kept visible briefly after checking them off. */
  lingering: Set<string>;
  query?: string;
}): Group[] {
  const { screen, lists, sections, reminders, lingering } = opts;
  const today = todayIso();
  const visible = (r: ReminderDto, showCompleted: boolean) => showCompleted || !r.completed || lingering.has(r.id);

  const q = opts.query?.trim().toLowerCase();
  if (q) {
    const hits = reminders.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q.replace(/^#/, ""))),
    );
    return byList(sortItems(hits, "due"), lists);
  }

  if (screen.kind === "list") {
    const list = lists.find((l) => l.id === screen.id);
    if (!list) return [];
    const top = sortItems(
      reminders.filter((r) => r.listId === list.id && !r.parentId && visible(r, list.showCompleted)),
      list.sortMode,
    );
    if (list.kind === "groceries") {
      const groups = new Map<string, ReminderDto[]>();
      for (const r of top) {
        const aisle = r.completed && !lingering.has(r.id) ? "נקנו" : aisleFor(r.title);
        groups.set(aisle, [...(groups.get(aisle) ?? []), r]);
      }
      return [...AISLE_ORDER, "נקנו"]
        .filter((a) => groups.has(a))
        .map((a) => ({ key: a, title: a, items: groups.get(a)! }));
    }
    const listSections = sections.filter((s) => s.listId === list.id).sort((a, b) => a.position - b.position);
    const known = new Set(listSections.map((s) => s.id));
    return [
      { key: "none", sectionId: null, items: top.filter((r) => !r.sectionId || !known.has(r.sectionId)) },
      ...listSections.map((s) => ({ key: s.id, title: s.name, sectionId: s.id, items: top.filter((r) => r.sectionId === s.id) })),
    ];
  }

  if (screen.kind === "tag") {
    return byList(
      sortItems(reminders.filter((r) => r.tags.includes(screen.tag) && visible(r, false)), "due"),
      lists,
    );
  }

  if (screen.kind !== "smart") return [];
  const id = screen.id;
  const matches = reminders.filter((r) => smartMatches(id, r, today) || (lingering.has(r.id) && id !== "completed"));

  if (id === "today") {
    const overdue = matches.filter((r) => r.dueDate! < today);
    const todays = sortItems(matches.filter((r) => r.dueDate === today), "due");
    const part = (from: string, to: string) => todays.filter((r) => r.dueTime && r.dueTime >= from && r.dueTime < to);
    return [
      { key: "overdue", title: "באיחור", tone: "danger" as const, items: sortItems(overdue, "due") },
      { key: "allday", title: "במהלך היום", items: todays.filter((r) => !r.dueTime) },
      { key: "morning", title: "בוקר", items: part("00:00", "12:00") },
      { key: "afternoon", title: "צהריים", items: part("12:00", "17:00") },
      { key: "evening", title: "ערב", items: part("17:00", "24:00") },
    ].filter((g) => g.items.length > 0);
  }

  if (id === "scheduled") {
    const sorted = sortItems(matches, "due");
    const overdue = sorted.filter((r) => isOverdue(r.dueDate, null) && r.dueDate! < today);
    const dates = [...new Set(sorted.filter((r) => r.dueDate! >= today).map((r) => r.dueDate!))];
    return [
      ...(overdue.length ? [{ key: "overdue", title: "באיחור", tone: "danger" as const, items: overdue }] : []),
      ...dates.map((d) => ({ key: d, title: formatDayHeading(d), items: sorted.filter((r) => r.dueDate === d) })),
    ];
  }

  if (id === "completed") {
    return byList(
      [...matches].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
      lists,
    );
  }

  return byList(sortItems(matches, id === "flagged" ? "due" : "manual"), lists);
}
