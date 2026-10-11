"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { todayIso } from "@/app/lib/reminders/dates";
import { LIST_COLORS, type ReminderDto, type RemindersData } from "@/app/lib/reminders/types";
import { IconChevronLeft, IconChevronRight, IconCopy, IconPencil, IconPlus, IconSearch, IconTrash } from "@/app/ui/icons";
import { PressMenu, PressableRow, type MenuItem } from "@/app/ui/PressMenu";
import DetailSheet from "./DetailSheet";
import {
  IconCalendar,
  IconCalendarDay,
  IconCheckCircle,
  IconFlag,
  IconIndent,
  IconInfo,
  IconMore,
  IconOutdent,
  IconTray,
  ListGlyph,
} from "./icons";
import { ListEditorSheet, ListOptionsSheet, type ListDraft } from "./ListSheets";
import PushCard from "./PushCard";
import QuickAdd, { type QuickDefaults } from "./QuickAdd";
import ReminderRow from "./ReminderRow";
import Sheet from "./Sheet";
import { useRemindersStore } from "./useRemindersStore";
import { allTags, buildGroups, SMART, smartCounts, type Group, type Screen, type SmartId } from "./views";

const LINGER_MS = 1600;

const SMART_ICONS: Record<SmartId, (p: { className?: string }) => React.ReactNode> = {
  today: (p) => <IconCalendarDay {...p} day={new Date().getDate()} />,
  scheduled: IconCalendar,
  all: IconTray,
  flagged: (p) => <IconFlag {...p} filled />,
  completed: IconCheckCircle,
};

type MenuState = { anchor: DOMRect; title: string; items: MenuItem[] } | null;

export default function RemindersClient(props: { initial: RemindersData; openId?: string | null }) {
  const store = useRemindersStore(props.initial);
  const { lists, sections, reminders } = store;
  const [rawScreen, setScreen] = useState<Screen>({ kind: "home" });
  const screen: Screen =
    rawScreen.kind === "list" && !lists.some((l) => l.id === rawScreen.id) ? { kind: "home" } : rawScreen;
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(
    props.openId && props.initial.reminders.some((r) => r.id === props.openId) ? props.openId : null,
  );
  const [menu, setMenu] = useState<MenuState>(null);
  const [openRow, setOpenRow] = useState<{ id: string; side: "trailing" | "leading" } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const [listEditor, setListEditor] = useState<{ id: string | null } | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [sectionEdit, setSectionEdit] = useState<{ id: string; name: string } | null>(null);
  const lingerTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const onNav = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "/reminders") return;
      setScreen({ kind: "home" });
      setQuery("");
      setDetailId(null);
    };
    window.addEventListener("nf:nav", onNav);
    if (new URLSearchParams(window.location.search).has("r")) window.history.replaceState(null, "", "/reminders");
    return () => window.removeEventListener("nf:nav", onNav);
  }, []);

  const screenKey = rawScreen.kind === "home" ? "home" : JSON.stringify(rawScreen);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screenKey]);

  const listOf = (id: string) => lists.find((l) => l.id === id);
  const colorOf = (listId: string) => LIST_COLORS[listOf(listId)?.color ?? "blue"] ?? LIST_COLORS.blue;
  const defaultListId = lists[0]?.id;

  function toggle(r: ReminderDto) {
    if (!r.completed) {
      if (navigator.vibrate) navigator.vibrate(8);
      setLingering((s) => new Set(s).add(r.id));
      const prev = lingerTimers.current.get(r.id);
      if (prev) clearTimeout(prev);
      lingerTimers.current.set(
        r.id,
        setTimeout(() => {
          setLingering((s) => {
            const n = new Set(s);
            n.delete(r.id);
            return n;
          });
        }, LINGER_MS),
      );
    }
    store.toggleComplete(r.id);
  }

  function rowMenu(r: ReminderDto, anchor: DOMRect, ordered: ReminderDto[]) {
    const canIndent = !r.parentId && ordered.filter((x) => !x.parentId && x.listId === r.listId)[0]?.id !== r.id;
    setMenu({
      anchor,
      title: r.title || "תזכורת",
      items: [
        { label: "פרטים", icon: IconInfo, onSelect: () => setDetailId(r.id) },
        {
          label: r.flagged ? "הסר דגל" : "סמן בדגל",
          icon: IconFlag,
          onSelect: () => store.updateReminder(r.id, { flagged: !r.flagged }),
        },
        { label: "שכפל", icon: IconCopy, onSelect: () => store.duplicateReminder(r.id) },
        ...(r.parentId
          ? [{ label: "הוצא מתת־משימה", icon: IconOutdent, onSelect: () => store.outdent(r.id) }]
          : canIndent
            ? [{ label: "הפוך לתת־משימה", icon: IconIndent, onSelect: () => store.indent(r.id, ordered) }]
            : []),
        { label: "מחק", icon: IconTrash, danger: true, onSelect: () => store.deleteReminder(r.id) },
      ],
    });
  }

  function saveList(draft: ListDraft) {
    if (listEditor?.id) store.updateList(listEditor.id, draft);
    else void store.createList(draft).then((id) => setScreen({ kind: "list", id }));
    setListEditor(null);
  }

  // ─── Rows ──────────────────────────────────────────────────────────────────

  function renderRows(items: ReminderDto[], opts: { nested: boolean; showList: boolean; ordered: ReminderDto[] }) {
    const out: React.ReactNode[] = [];
    const walk = (r: ReminderDto, depth: number) => {
      const list = listOf(r.listId);
      const subs = opts.nested
        ? reminders
            .filter((x) => x.parentId === r.id && (list?.showCompleted || !x.completed || lingering.has(x.id)))
            .sort((a, b) => a.position - b.position)
        : [];
      const isCollapsed = collapsed.has(r.id);
      const tops = opts.ordered.filter((x) => !x.parentId && x.listId === r.listId);
      out.push(
        <ReminderRow
          key={r.id}
          r={r}
          color={colorOf(r.listId)}
          depth={depth}
          listLabel={opts.showList ? list?.name : undefined}
          subCount={subs.length}
          collapsed={isCollapsed}
          onToggleCollapse={() =>
            setCollapsed((s) => {
              const n = new Set(s);
              if (n.has(r.id)) n.delete(r.id);
              else n.add(r.id);
              return n;
            })
          }
          open={openRow?.id === r.id ? openRow.side : null}
          onOpenChange={(side) => setOpenRow(side ? { id: r.id, side } : null)}
          canIndent={opts.nested && !r.parentId && tops[0]?.id !== r.id}
          onToggle={() => toggle(r)}
          onDetails={() => {
            setOpenRow(null);
            setDetailId(r.id);
          }}
          onDelete={() => {
            setOpenRow(null);
            store.deleteReminder(r.id);
          }}
          onFlag={() => {
            setOpenRow(null);
            store.updateReminder(r.id, { flagged: !r.flagged });
          }}
          onIndent={() => {
            setOpenRow(null);
            store.indent(r.id, opts.ordered);
          }}
          onOutdent={() => {
            setOpenRow(null);
            store.outdent(r.id);
          }}
          onLongPress={(rect) => rowMenu(r, rect, opts.ordered)}
        />,
      );
      if (!isCollapsed) for (const s of subs) walk(s, depth + 1);
    };
    for (const r of items) walk(r, 0);
    return out;
  }

  // ─── Home ──────────────────────────────────────────────────────────────────

  const counts = smartCounts(reminders);
  const tags = allTags(reminders);

  const overlays = (
    <>
      {detailId ? <DetailSheet store={store} id={detailId} onClose={() => setDetailId(null)} /> : null}
      {listEditor ? (
        <ListEditorSheet
          isNew={!listEditor.id}
          initial={listEditor.id ? (listOf(listEditor.id) ?? null) : null}
          onClose={() => setListEditor(null)}
          onSave={saveList}
        />
      ) : null}
      {newOpen && defaultListId ? (
        <NewReminderSheet
          store={store}
          defaultListId={screen.kind === "list" ? screen.id : defaultListId}
          onClose={() => setNewOpen(false)}
        />
      ) : null}
      {sectionEdit ? (
        <Sheet
          open
          onClose={() => setSectionEdit(null)}
          title="שם הסקשן"
          end={
            <button
              type="button"
              className="rem-sheet-done"
              disabled={!sectionEdit.name.trim()}
              onClick={() => {
                store.renameSection(sectionEdit.id, sectionEdit.name.trim());
                setSectionEdit(null);
              }}
            >
              סיום
            </button>
          }
        >
          <div className="rem-group">
            <input
              className="rem-detail-title"
              value={sectionEdit.name}
              onChange={(e) => setSectionEdit({ ...sectionEdit, name: e.target.value })}
              autoFocus
              maxLength={80}
            />
          </div>
        </Sheet>
      ) : null}
      {menu ? createPortal(<PressMenu {...menu} onClose={() => setMenu(null)} />, document.body) : null}
      {store.undo ? (
        <div className="rem-toast" role="status">
          <span>{store.undo.label}</span>
          <button type="button" onClick={store.runUndo}>
            בטל
          </button>
        </div>
      ) : store.error ? (
        <div className="rem-toast is-error" role="alert">
          {store.error}
        </div>
      ) : null}
    </>
  );

  if (screen.kind === "home" && !query.trim()) {
    return (
      <div className="rem">
        <header className="rem-home-head">
          <h1 className="rem-large-title">תזכורות</h1>
        </header>
        <SearchBox value={query} onChange={setQuery} />

        <div className="rem-smart-grid">
          {(Object.keys(SMART) as SmartId[]).map((id) => {
            const Icon = SMART_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                className={`rem-smart is-${id}`}
                style={{ "--tile": SMART[id].color } as React.CSSProperties}
                onClick={() => setScreen({ kind: "smart", id })}
              >
                <span className="rem-smart-icon">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rem-smart-count">{id === "completed" ? "" : counts[id]}</span>
                <span className="rem-smart-name">{SMART[id].title}</span>
              </button>
            );
          })}
        </div>

        <PushCard />

        <h2 className="rem-section-label">הרשימות שלי</h2>
        <ul className="rem-group rem-lists">
          {lists.map((l) => {
            const color = LIST_COLORS[l.color] ?? LIST_COLORS.blue;
            const count = reminders.filter((r) => r.listId === l.id && !r.completed).length;
            return (
              <li key={l.id}>
                <PressableRow
                  className="rem-list-row"
                  onTap={() => setScreen({ kind: "list", id: l.id })}
                  onLongPress={(anchor) =>
                    setMenu({
                      anchor,
                      title: l.name,
                      items: [
                        { label: "עריכת רשימה", icon: IconPencil, onSelect: () => setListEditor({ id: l.id }) },
                        {
                          label: "מחק רשימה",
                          icon: IconTrash,
                          danger: true,
                          onSelect: () => {
                            if (lists.length === 1) return alert("צריך להשאיר לפחות רשימה אחת.");
                            if (confirm(`למחוק את "${l.name}" וכל התזכורות שבה?`)) store.deleteList(l.id);
                          },
                        },
                      ],
                    })
                  }
                >
                  <span className="rem-list-badge" style={{ background: color }}>
                    <ListGlyph icon={l.icon} className="h-4.5 w-4.5" />
                  </span>
                  <span className="rem-list-row-name">{l.name}</span>
                  <span className="rem-list-row-count">{count}</span>
                  <IconChevronLeft className="rem-chevron" />
                </PressableRow>
              </li>
            );
          })}
        </ul>

        {tags.length ? (
          <>
            <h2 className="rem-section-label">תגיות</h2>
            <div className="rem-tag-browser">
              {tags.map((t) => (
                <button key={t} type="button" className="rem-chip is-tag" onClick={() => setScreen({ kind: "tag", tag: t })}>
                  #{t}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="rem-home-bar">
          <button type="button" className="rem-new-btn" onClick={() => setNewOpen(true)}>
            <span className="rem-new-plus">
              <IconPlus className="h-4.5 w-4.5" />
            </span>
            תזכורת חדשה
          </button>
          <button type="button" className="rem-text-btn" onClick={() => setListEditor({ id: null })}>
            הוסף רשימה
          </button>
        </div>
        {overlays}
      </div>
    );
  }

  // ─── List / smart / tag / search ───────────────────────────────────────────

  const searching = Boolean(query.trim());
  const list = screen.kind === "list" ? listOf(screen.id) : undefined;
  const groups = buildGroups({ screen, lists, sections, reminders, lingering, query });
  const ordered = groups.flatMap((g) => g.items);
  const color = searching
    ? "var(--brand)"
    : list
      ? (LIST_COLORS[list.color] ?? LIST_COLORS.blue)
      : screen.kind === "smart"
        ? SMART[screen.id].color
        : "var(--brand)";
  const title = searching
    ? "תוצאות חיפוש"
    : list
      ? list.name
      : screen.kind === "smart"
        ? SMART[screen.id].title
        : screen.kind === "tag"
          ? `#${screen.tag}`
          : "";
  const nested = Boolean(list) && !searching;
  const showList = !list || searching;
  const total = ordered.length;
  const completedInList = list ? reminders.filter((r) => r.listId === list.id && r.completed).length : 0;

  const quickDefaults: QuickDefaults =
    screen.kind === "smart"
      ? screen.id === "today" || screen.id === "scheduled"
        ? { dueDate: todayIso() }
        : screen.id === "flagged"
          ? { flagged: true }
          : {}
      : screen.kind === "tag"
        ? { tags: [screen.tag] }
        : {};
  const canAdd = !searching && !(screen.kind === "smart" && screen.id === "completed") && Boolean(defaultListId);
  const addTo = list?.id ?? defaultListId!;
  const addColor = colorOf(addTo);
  const add = (sectionId: string | null) => (input: Partial<ReminderDto> & { title: string }) =>
    store.createReminder({ ...input, listId: addTo, sectionId: sectionId ?? input.sectionId ?? null });

  const sectionHeader = (g: Group) =>
    g.title ? (
      list && g.sectionId ? (
        <PressableRow
          className={`rem-group-head${g.tone === "danger" ? " is-danger" : ""}`}
          onTap={() => setSectionEdit({ id: g.sectionId!, name: g.title! })}
          onLongPress={(anchor) =>
            setMenu({
              anchor,
              title: g.title!,
              items: [
                { label: "שנה שם", icon: IconPencil, onSelect: () => setSectionEdit({ id: g.sectionId!, name: g.title! }) },
                { label: "מחק סקשן", icon: IconTrash, danger: true, onSelect: () => store.deleteSection(g.sectionId!) },
              ],
            })
          }
        >
          {g.title}
        </PressableRow>
      ) : (
        <h3 className={`rem-group-head${g.tone === "danger" ? " is-danger" : ""}`}>{g.title}</h3>
      )
    ) : null;

  const columns = list?.viewMode === "columns" && list.kind !== "groceries" && !searching;
  const visibleGroups = groups.filter((g) => g.items.length > 0 || (list && list.kind !== "groceries"));

  return (
    <div className="rem" style={{ "--list": color } as React.CSSProperties}>
      <nav className="rem-nav">
        <button
          type="button"
          className="rem-back"
          onClick={() => {
            setQuery("");
            setScreen({ kind: "home" });
          }}
        >
          <IconChevronRight className="h-5 w-5" />
          רשימות
        </button>
        {list ? (
          <button type="button" className="rem-nav-icon" onClick={() => setOptionsOpen(true)} aria-label="אפשרויות רשימה">
            <IconMore className="h-6 w-6" />
          </button>
        ) : null}
      </nav>

      {searching || screen.kind === "home" ? <SearchBox value={query} onChange={setQuery} /> : null}

      <header className="rem-list-head">
        <h1 className="rem-large-title is-colored">{title}</h1>
        <span className="rem-list-count">{total}</span>
      </header>

      {total === 0 && !(list && list.kind !== "groceries" && sections.some((s) => s.listId === list.id)) ? (
        <div className="rem-empty">
          <span className="rem-empty-icon">
            <IconCheckCircle className="h-8 w-8" />
          </span>
          <p>{searching ? "לא נמצאו תזכורות" : screen.kind === "smart" && screen.id === "completed" ? "עוד לא השלמת כלום" : "אין תזכורות"}</p>
        </div>
      ) : null}

      {columns ? (
        <div className="rem-columns">
          {groups.map((g) => (
            <section key={g.key} className="rem-column">
              <h3 className="rem-column-head">{g.title ?? "ללא סקשן"}</h3>
              <div className="rem-column-body">{renderRows(g.items, { nested, showList, ordered })}</div>
              <QuickAdd color={addColor} onAdd={add(g.sectionId ?? null)} label="הוסף" />
            </section>
          ))}
        </div>
      ) : (
        <div className="rem-groups">
          {visibleGroups.map((g) => (
            <section key={g.key} className="rem-section">
              {sectionHeader(g)}
              <div className="rem-rows">{renderRows(g.items, { nested, showList, ordered })}</div>
              {canAdd && list && list.kind !== "groceries" && g.sectionId !== undefined ? (
                <QuickAdd color={addColor} onAdd={add(g.sectionId)} />
              ) : null}
            </section>
          ))}
          {canAdd && !(list && list.kind !== "groceries") ? (
            <QuickAdd color={addColor} defaults={quickDefaults} onAdd={add(null)} />
          ) : null}
        </div>
      )}

      {optionsOpen && list ? (
        <ListOptionsSheet
          list={list}
          completedCount={completedInList}
          onClose={() => setOptionsOpen(false)}
          onUpdate={(patch) => store.updateList(list.id, patch)}
          onEdit={() => {
            setOptionsOpen(false);
            setListEditor({ id: list.id });
          }}
          onAddSection={(name) => store.createSection(list.id, name)}
          onClearCompleted={() => store.clearCompleted(list.id)}
          onDelete={() => {
            setOptionsOpen(false);
            store.deleteList(list.id);
            setScreen({ kind: "home" });
          }}
        />
      ) : null}
      {overlays}
    </div>
  );
}

function SearchBox(props: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="rem-search">
      <IconSearch className="h-[1.1rem] w-[1.1rem]" />
      <input
        type="search"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder="חיפוש בכל התזכורות"
        aria-label="חיפוש"
        enterKeyHint="search"
      />
    </div>
  );
}

function NewReminderSheet(props: {
  store: ReturnType<typeof useRemindersStore>;
  defaultListId: string;
  onClose: () => void;
}) {
  const { store } = props;
  const [listId, setListId] = useState(props.defaultListId);
  const color = LIST_COLORS[store.lists.find((l) => l.id === listId)?.color ?? "blue"] ?? LIST_COLORS.blue;
  return (
    <Sheet
      open
      onClose={props.onClose}
      title="תזכורת חדשה"
      start={
        <button type="button" className="rem-sheet-cancel" onClick={props.onClose}>
          ביטול
        </button>
      }
    >
      <div className="rem-group">
        <QuickAdd
          color={color}
          autoOpen
          onAdd={(input) => {
            store.createReminder({ ...input, listId });
            props.onClose();
          }}
        />
      </div>
      <div className="rem-group">
        <label className="rem-cell">
          <span className="rem-cell-icon" style={{ background: color }}>
            <ListGlyph icon={store.lists.find((l) => l.id === listId)?.icon ?? "list"} className="h-4.5 w-4.5" />
          </span>
          <span className="rem-cell-label">רשימה</span>
          <select className="rem-cell-select" value={listId} onChange={(e) => setListId(e.target.value)}>
            {store.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="rem-hint">
        אפשר לכתוב בשפה חופשית: &quot;פגישה מחר ב-4&quot;, &quot;לשלם חשבון כל חודש&quot;, &quot;!!&quot; לעדיפות, &quot;#בית&quot; לתגית.
      </p>
    </Sheet>
  );
}
