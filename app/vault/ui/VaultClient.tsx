"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AppModal from "@/app/ui/AppModal";
import { PressMenu, PressableRow, type MenuItem } from "@/app/ui/PressMenu";
import type { VaultFolderDto, VaultItemDto } from "@/app/lib/vault/server";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconEye,
  IconFolder,
  IconFolderPlus,
  IconEyeOff,
  IconKey,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStar,
  IconTrash,
} from "@/app/ui/icons";
import { generatePassword } from "@/app/lib/vault/password";
import {
  FIELD_KIND_LABELS,
  ITEM_TYPE_LABELS,
  itemSubtitle,
  newField,
  templateFor,
  VAULT_SCOPE_COOKIE,
  type VaultField,
  type VaultFieldKind,
  type VaultItemData,
  type VaultItemType,
} from "@/app/lib/vault/items";

const CLIPBOARD_CLEAR_MS = 45 * 1000;

type Item = VaultItemDto;
type Folder = VaultFolderDto;
type Scope = { kind: "all" } | { kind: "folder"; id: string } | { kind: "trash" };
type View =
  | { kind: "folders" }
  | { kind: "list" }
  | { kind: "detail"; id: string }
  | { kind: "edit"; id: string | null; draft: VaultItemData };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "השמירה נכשלה");
  }
  return (await res.json()) as T;
}

function initialOf(title: string) {
  const ch = title.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

function hueOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function rememberScope(scope: Scope) {
  if (scope.kind === "trash") return;
  const value = scope.kind === "folder" ? scope.id : "all";
  document.cookie = `${VAULT_SCOPE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export default function VaultClient(props: { initial: Item[]; folders: Folder[]; initialFolderId: string | null }) {
  const [items, setItems] = useState<Item[]>(props.initial);
  const [folders, setFolders] = useState<Folder[]>(props.folders);
  const [view, setView] = useState<View>({ kind: "list" });
  const [scope, setScopeState] = useState<Scope>(
    props.initialFolderId ? { kind: "folder", id: props.initialFolderId } : { kind: "all" },
  );

  function setScope(next: Scope) {
    setScopeState(next);
    rememberScope(next);
  }
  const [query, setQuery] = useState("");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<{ id: string | null; name: string } | null>(null);
  const [menu, setMenu] = useState<{ anchor: DOMRect; title: string; items: MenuItem[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (clipTimer.current) clearTimeout(clipTimer.current);
  }, []);

  useEffect(() => {
    const onNav = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "/vault") return;
      setMenu(null);
      setScopeState((s) => (s.kind === "trash" ? { kind: "all" } : s));
      setView({ kind: "list" });
    };
    window.addEventListener("nf:nav", onNav);
    return () => window.removeEventListener("nf:nav", onNav);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  async function copy(value: string, secret: boolean) {
    try {
      await navigator.clipboard.writeText(value);
      showToast("הועתק");
      if (secret) {
        if (clipTimer.current) clearTimeout(clipTimer.current);
        clipTimer.current = setTimeout(() => {
          void navigator.clipboard.writeText("").catch(() => null);
        }, CLIPBOARD_CLEAR_MS);
      }
    } catch {
      showToast("לא הצלחתי להעתיק");
    }
  }

  function upsert(row: Item) {
    setItems((prev) => [row, ...prev.filter((i) => i.id !== row.id)]);
  }

  async function saveItem(id: string | null, data: VaultItemData) {
    const row = await api<Item>(id ? `/api/vault/items/${id}` : "/api/vault/items", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(id ? { data } : { data, folderId: scope.kind === "folder" ? scope.id : null }),
    });
    upsert(row);
    return row.id;
  }

  async function trashItem(id: string) {
    const row = await api<Item>(`/api/vault/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ deleted: true }),
    });
    upsert(row);
  }

  async function restoreItem(id: string) {
    try {
      upsert(await api<Item>(`/api/vault/items/${id}`, { method: "PATCH", body: JSON.stringify({ deleted: false }) }));
      showToast("שוחזר");
    } catch {
      showToast("השחזור נכשל");
    }
  }

  async function purgeItem(id: string) {
    try {
      await api(`/api/vault/items/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      showToast("המחיקה נכשלה");
    }
  }

  async function duplicateItem(item: Item) {
    try {
      const row = await api<Item>("/api/vault/items", {
        method: "POST",
        body: JSON.stringify({ data: structuredClone(item.data), folderId: item.folderId }),
      });
      upsert(row);
      showToast("שוכפל");
    } catch {
      showToast("השכפול נכשל");
    }
  }

  async function toggleFavorite(item: Item) {
    try {
      await saveItem(item.id, { ...item.data, favorite: !item.data.favorite });
    } catch {
      showToast("השמירה נכשלה");
    }
  }

  async function saveFolder() {
    if (!folderDialog) return;
    const name = folderDialog.name.trim();
    if (!name) return;
    const { id } = folderDialog;
    setFolderDialog(null);
    try {
      const row = await api<Folder>(id ? `/api/vault/folders/${id}` : "/api/vault/folders", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({ name }),
      });
      setFolders((list) => (id ? list.map((f) => (f.id === id ? row : f)) : [...list, row]));
    } catch {
      showToast("השמירה נכשלה");
    }
  }

  async function deleteFolder(folder: Folder) {
    const count = active.filter((i) => i.folderId === folder.id).length;
    const msg = count
      ? `למחוק את התיקייה "${folder.name}"? ${count} הפריטים שבה יעברו לנמחקו לאחרונה.`
      : `למחוק את התיקייה "${folder.name}"?`;
    if (!confirm(msg)) return;
    try {
      const { deletedAt } = await api<{ deletedAt: string }>(`/api/vault/folders/${folder.id}`, { method: "DELETE" });
      setFolders((list) => list.filter((f) => f.id !== folder.id));
      setItems((list) =>
        list.map((i) => (i.folderId === folder.id ? { ...i, folderId: null, deletedAt: i.deletedAt ?? deletedAt } : i)),
      );
      if (scope.kind === "folder" && scope.id === folder.id) {
        setScope({ kind: "all" });
        setView({ kind: "folders" });
      }
    } catch {
      showToast("המחיקה נכשלה");
    }
  }

  async function purgeAll() {
    if (!confirm(`למחוק סופית ${trash.length} פריטים? אי אפשר לשחזר.`)) return;
    for (const i of trash) await purgeItem(i.id);
  }

  function openItemMenu(item: Item, anchor: DOMRect) {
    const title = item.data.title || "ללא שם";
    if (item.deletedAt) {
      setMenu({
        anchor,
        title,
        items: [
          { label: "שחזר", icon: IconRefresh, onSelect: () => void restoreItem(item.id) },
          {
            label: "מחק לצמיתות",
            icon: IconTrash,
            danger: true,
            onSelect: () => {
              if (confirm(`למחוק סופית את "${title}"? אי אפשר לשחזר.`)) void purgeItem(item.id);
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
          label: item.data.favorite ? "הסר ממועדפים" : "הוסף למועדפים",
          icon: IconStar,
          onSelect: () => void toggleFavorite(item),
        },
        { label: "שכפל", icon: IconCopy, onSelect: () => void duplicateItem(item) },
        {
          label: "מחק",
          icon: IconTrash,
          danger: true,
          onSelect: () => void trashItem(item.id).catch(() => showToast("המחיקה נכשלה")),
        },
      ],
    });
  }

  function openFolderMenu(folder: Folder, anchor: DOMRect) {
    setMenu({
      anchor,
      title: folder.name,
      items: [
        { label: "שנה שם", icon: IconPencil, onSelect: () => setFolderDialog({ id: folder.id, name: folder.name }) },
        { label: "מחק תיקייה", icon: IconTrash, danger: true, onSelect: () => void deleteFolder(folder) },
      ],
    });
  }

  const active = items.filter((i) => !i.deletedAt);
  const trash = items
    .filter((i) => i.deletedAt)
    .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
  const scopeItems =
    scope.kind === "trash"
      ? trash
      : scope.kind === "folder"
        ? active.filter((i) => i.folderId === scope.id)
        : active;

  const q = query.trim().toLowerCase();
  const matches = scopeItems.filter((i) => {
    if (!q) return true;
    if (i.data.title.toLowerCase().includes(q)) return true;
    return i.data.fields.some(
      (f) => f.kind !== "secret" && (f.value.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)),
    );
  });
  const visible =
    scope.kind === "trash"
      ? matches
      : matches.sort((a, b) => {
          if (!!a.data.favorite !== !!b.data.favorite) return a.data.favorite ? -1 : 1;
          return a.data.title.localeCompare(b.data.title, "he");
        });

  const scopeTitle =
    scope.kind === "trash"
      ? "נמחקו לאחרונה"
      : scope.kind === "folder"
        ? (folders.find((f) => f.id === scope.id)?.name ?? "תיקייה")
        : "סיסמאות";

  const overlays = (
    <>
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
            placeholder="שם התיקייה"
            maxLength={80}
            autoFocus
          />
          <button type="submit" className="notes-folder-submit" disabled={!folderDialog?.name.trim()}>
            {folderDialog?.id ? "שמור" : "צור תיקייה"}
          </button>
        </form>
      </AppModal>
      {menu ? createPortal(<PressMenu {...menu} onClose={() => setMenu(null)} />, document.body) : null}
      {toast ? <div className="vlt-toast" role="status">{toast}</div> : null}
    </>
  );

  if (view.kind === "edit") {
    return (
      <ItemEditor
        initial={view.draft}
        isNew={view.id === null}
        onCancel={() => setView(view.id ? { kind: "detail", id: view.id } : { kind: "list" })}
        onSave={async (data) => {
          const id = await saveItem(view.id, data);
          setView({ kind: "detail", id });
          showToast("נשמר");
        }}
        onDelete={view.id ? async () => {
          await trashItem(view.id!);
          setView({ kind: "list" });
          showToast("הועבר לנמחקו לאחרונה");
        } : undefined}
      />
    );
  }

  if (view.kind === "detail") {
    const item = items.find((i) => i.id === view.id);
    if (item) {
      return (
        <>
          <ItemDetail
            item={item}
            backLabel={scopeTitle}
            onBack={() => setView({ kind: "list" })}
            onEdit={() => setView({ kind: "edit", id: item.id, draft: structuredClone(item.data) })}
            onCopy={copy}
            onToggleFavorite={() => void toggleFavorite(item)}
          />
          {toast ? <div className="vlt-toast" role="status">{toast}</div> : null}
        </>
      );
    }
  }

  if (view.kind === "folders") {
    const open = (s: Scope) => {
      setScope(s);
      setQuery("");
      setView({ kind: "list" });
    };
    return (
      <div className="vlt">
        <header className="vlt-top">
          <h1 className="vlt-title">תיקיות</h1>
          <button
            type="button"
            className="notes-nav-icon"
            onClick={() => setFolderDialog({ id: null, name: "" })}
            aria-label="תיקייה חדשה"
          >
            <IconFolderPlus className="h-5.5 w-5.5" />
          </button>
        </header>

        <ul className="notes-folder-group">
          <li>
            <PressableRow className="notes-folder-row" onTap={() => open({ kind: "all" })}>
              <IconKey className="notes-folder-icon" />
              <span className="notes-folder-name">כל הסיסמאות</span>
              <span className="notes-folder-count">{active.length}</span>
              <IconChevronLeft className="notes-folder-chevron" />
            </PressableRow>
          </li>
          {folders.map((f) => (
            <li key={f.id}>
              <PressableRow
                className="notes-folder-row"
                onTap={() => open({ kind: "folder", id: f.id })}
                onLongPress={(rect) => openFolderMenu(f, rect)}
              >
                <IconFolder className="notes-folder-icon" />
                <span className="notes-folder-name">{f.name}</span>
                <span className="notes-folder-count">{active.filter((i) => i.folderId === f.id).length}</span>
                <IconChevronLeft className="notes-folder-chevron" />
              </PressableRow>
            </li>
          ))}
          <li>
            <PressableRow className="notes-folder-row" onTap={() => open({ kind: "trash" })}>
              <IconTrash className="notes-folder-icon" />
              <span className="notes-folder-name">נמחקו לאחרונה</span>
              <span className="notes-folder-count">{trash.length}</span>
              <IconChevronLeft className="notes-folder-chevron" />
            </PressableRow>
          </li>
        </ul>
        <p className="notes-folders-hint">לחיצה ארוכה על תיקייה כדי לשנות שם או למחוק</p>
        {overlays}
      </div>
    );
  }

  return (
    <div className="vlt">
      <header className="vlt-nav">
        <button type="button" className="vlt-back" onClick={() => setView({ kind: "folders" })}>
          <IconChevronRight className="h-5 w-5" />
          תיקיות
        </button>
        {scope.kind === "trash" && trash.length > 0 ? (
          <button type="button" className="notes-nav-text is-danger" onClick={() => void purgeAll()}>
            מחק הכל
          </button>
        ) : null}
      </header>

      <header className="vlt-top">
        <div>
          <h1 className="vlt-title">{scopeTitle}</h1>
          <p className="vlt-count">{scopeItems.length} פריטים</p>
        </div>
      </header>

      <div className="vlt-search">
        <IconSearch className="h-[1.1rem] w-[1.1rem]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש"
          aria-label="חיפוש"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>

      {visible.length === 0 ? (
        <div className="vlt-empty">
          {scope.kind === "trash" ? <IconTrash className="h-7 w-7" /> : <IconKey className="h-7 w-7" />}
          <p>
            {scopeItems.length > 0
              ? "לא נמצאו פריטים."
              : scope.kind === "trash"
                ? "אין פריטים שנמחקו."
                : "עדיין אין כלום. הוסף את הפריט הראשון."}
          </p>
        </div>
      ) : (
        <>
          {scope.kind === "trash" ? (
            <p className="notes-folders-hint">לחיצה על פריט כדי לשחזר או למחוק סופית</p>
          ) : null}
          <div className="vlt-group">
            {visible.map((item) => (
              <PressableRow
                key={item.id}
                className="vlt-row"
                onTap={(rect) =>
                  item.deletedAt ? openItemMenu(item, rect) : setView({ kind: "detail", id: item.id })
                }
                onLongPress={(rect) => openItemMenu(item, rect)}
              >
                <span className="vlt-avatar" style={{ "--h": hueOf(item.data.title) } as React.CSSProperties}>
                  {initialOf(item.data.title)}
                </span>
                <span className="vlt-row-text">
                  <span className="vlt-row-title">
                    {item.data.title || "ללא שם"}
                    {item.data.favorite ? <IconStar filled className="vlt-row-star" /> : null}
                  </span>
                  <span className="vlt-row-sub">{itemSubtitle(item.data)}</span>
                </span>
                {item.deletedAt ? null : <IconChevronLeft className="vlt-row-chevron" />}
              </PressableRow>
            ))}
          </div>
        </>
      )}

      {scope.kind !== "trash" ? (
        <button type="button" className="vlt-fab" onClick={() => setTypePickerOpen(true)} aria-label="הוסף פריט">
          <IconPlus className="h-6 w-6" />
        </button>
      ) : null}

      <AppModal open={typePickerOpen} onClose={() => setTypePickerOpen(false)} title="מה להוסיף?">
        <div className="vlt-group vlt-sheet-list">
          {(Object.keys(ITEM_TYPE_LABELS) as VaultItemType[]).map((t) => (
            <button
              key={t}
              type="button"
              className="vlt-row"
              onClick={() => {
                setTypePickerOpen(false);
                setView({ kind: "edit", id: null, draft: templateFor(t) });
              }}
            >
              <span className="vlt-row-text">
                <span className="vlt-row-title">{ITEM_TYPE_LABELS[t]}</span>
                <span className="vlt-row-sub">
                  {t === "login" ? "משתמש, סיסמה ואתר" : t === "card" ? "מספר, תוקף ו־CVV" : t === "note" ? "טקסט חופשי" : "שדות לבחירתך"}
                </span>
              </span>
              <IconChevronLeft className="vlt-row-chevron" />
            </button>
          ))}
        </div>
      </AppModal>

      {overlays}
    </div>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────

function ItemDetail(props: {
  item: Item;
  backLabel: string;
  onBack: () => void;
  onEdit: () => void;
  onCopy: (value: string, secret: boolean) => void;
  onToggleFavorite: () => void;
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const d = props.item.data;
  const fields = d.fields.filter((f) => f.value.trim() !== "");

  return (
    <div className="vlt">
      <header className="vlt-nav">
        <button type="button" className="vlt-back" onClick={props.onBack}>
          <IconChevronRight className="h-5 w-5" />
          {props.backLabel}
        </button>
        <div className="vlt-top-actions">
          <button
            type="button"
            className={`vlt-icon-btn${d.favorite ? " is-on" : ""}`}
            onClick={props.onToggleFavorite}
            aria-label={d.favorite ? "הסר ממועדפים" : "הוסף למועדפים"}
            aria-pressed={!!d.favorite}
          >
            <IconStar filled={!!d.favorite} className="h-5 w-5" />
          </button>
          <button type="button" className="vlt-icon-btn" onClick={props.onEdit} aria-label="ערוך">
            <IconPencil className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="vlt-detail-head">
        <span className="vlt-avatar vlt-avatar--lg" style={{ "--h": hueOf(d.title) } as React.CSSProperties}>
          {initialOf(d.title)}
        </span>
        <h1 className="vlt-h1">{d.title || "ללא שם"}</h1>
        <span className="vlt-type">{ITEM_TYPE_LABELS[d.type]}</span>
      </div>

      {fields.length === 0 ? (
        <p className="vlt-lead">אין שדות עם תוכן. לחץ על העיפרון כדי להוסיף.</p>
      ) : (
        <div className="vlt-group">
          {fields.map((f) => {
            const secret = f.kind === "secret";
            const shown = !secret || revealed[f.id];
            return (
              <div key={f.id} className="vlt-field">
                <div className="vlt-field-main">
                  <span className="vlt-field-label">{f.label || FIELD_KIND_LABELS[f.kind]}</span>
                  {f.kind === "url" ? (
                    <a
                      className="vlt-field-value vlt-link"
                      href={/^https?:\/\//i.test(f.value) ? f.value : `https://${f.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                    >
                      {f.value}
                    </a>
                  ) : (
                    <span
                      className={`vlt-field-value${secret ? " is-secret" : ""}${f.kind === "multiline" ? " is-multi" : ""}`}
                      dir={secret || f.kind === "email" ? "ltr" : "auto"}
                    >
                      {shown ? f.value : "••••••••••"}
                    </span>
                  )}
                </div>
                {secret ? (
                  <button
                    type="button"
                    className="vlt-icon-btn"
                    onClick={() => setRevealed((r) => ({ ...r, [f.id]: !r[f.id] }))}
                    aria-label={shown ? "הסתר" : "הצג"}
                  >
                    {shown ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                  </button>
                ) : null}
                <button type="button" className="vlt-icon-btn" onClick={() => props.onCopy(f.value, secret)} aria-label={`העתק ${f.label}`}>
                  <IconCopy className="h-5 w-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="vlt-meta">עודכן {new Date(props.item.updatedAt).toLocaleDateString("he-IL")}</p>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function ItemEditor(props: {
  initial: VaultItemData;
  isNew: boolean;
  onCancel: () => void;
  onSave: (data: VaultItemData) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<VaultItemData>(props.initial);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [generatorFor, setGeneratorFor] = useState<string | null>(null);

  function updateField(id: string, patch: Partial<VaultField>) {
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  }

  function removeField(id: string) {
    setDraft((d) => ({ ...d, fields: d.fields.filter((f) => f.id !== id) }));
  }

  function addField(kind: VaultFieldKind) {
    setDraft((d) => ({ ...d, fields: [...d.fields, newField(kind)] }));
    setAddOpen(false);
  }

  async function save() {
    if (!draft.title.trim()) {
      setError("תן שם לפריט");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await props.onSave({ ...draft, title: draft.title.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "השמירה נכשלה");
      setBusy(false);
    }
  }

  async function remove() {
    if (!props.onDelete) return;
    if (!confirm(`להעביר את "${draft.title || "הפריט"}" לנמחקו לאחרונה?`)) return;
    setBusy(true);
    try {
      await props.onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "המחיקה נכשלה");
      setBusy(false);
    }
  }

  return (
    <div className="vlt vlt-editor">
      <header className="vlt-nav">
        <button type="button" className="vlt-back" onClick={props.onCancel}>ביטול</button>
        <span className="vlt-nav-title">{props.isNew ? ITEM_TYPE_LABELS[draft.type] : "עריכה"}</span>
        <span className="vlt-nav-spacer" />
      </header>

      <div className="vlt-group">
        <input
          className="vlt-title-input"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="שם (למשל Gmail, בנק, נטפליקס)"
          aria-label="שם הפריט"
          autoFocus={props.isNew}
        />
      </div>

      <div className="vlt-group">
        {draft.fields.map((f) => {
          const secret = f.kind === "secret";
          const shown = !secret || revealed[f.id];
          return (
            <div key={f.id} className="vlt-edit-field">
              <div className="vlt-edit-field-head">
                <input
                  className="vlt-edit-label"
                  value={f.label}
                  onChange={(e) => updateField(f.id, { label: e.target.value })}
                  placeholder={`שם השדה (${FIELD_KIND_LABELS[f.kind]})`}
                  aria-label="שם השדה"
                />
                <button type="button" className="vlt-icon-btn vlt-icon-btn--sm vlt-danger" onClick={() => removeField(f.id)} aria-label="מחק שדה">
                  <IconTrash className="h-[1.05rem] w-[1.05rem]" />
                </button>
              </div>
              <div className="vlt-edit-value-row">
                {f.kind === "multiline" ? (
                  <textarea
                    className="vlt-input vlt-textarea"
                    value={f.value}
                    onChange={(e) => updateField(f.id, { value: e.target.value })}
                    rows={4}
                    dir="auto"
                  />
                ) : (
                  <input
                    className={`vlt-input${secret ? " is-secret" : ""}`}
                    type={secret && !shown ? "password" : f.kind === "email" ? "email" : f.kind === "url" ? "url" : "text"}
                    value={f.value}
                    onChange={(e) => updateField(f.id, { value: e.target.value })}
                    dir={secret || f.kind === "email" || f.kind === "url" ? "ltr" : "auto"}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    inputMode={f.kind === "email" ? "email" : f.kind === "url" ? "url" : undefined}
                  />
                )}
                {secret ? (
                  <>
                    <button
                      type="button"
                      className="vlt-icon-btn"
                      onClick={() => setRevealed((r) => ({ ...r, [f.id]: !r[f.id] }))}
                      aria-label={shown ? "הסתר" : "הצג"}
                    >
                      {shown ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                    </button>
                    <button type="button" className="vlt-icon-btn" onClick={() => setGeneratorFor(f.id)} aria-label="צור סיסמה חזקה">
                      <IconRefresh className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        <button type="button" className="vlt-add" onClick={() => setAddOpen(true)}>
          <IconPlus className="h-5 w-5" />
          הוסף שדה
        </button>
      </div>

      {props.onDelete ? (
        <button type="button" className="vlt-delete" onClick={() => void remove()} disabled={busy}>
          <IconTrash className="h-4 w-4" />
          מחק פריט
        </button>
      ) : null}

      {error ? <p className="vlt-error" role="alert">{error}</p> : null}

      <div className="vlt-bar">
        <button type="button" className="btn btn-primary vlt-cta" onClick={() => void save()} disabled={busy}>
          {busy ? "שומר…" : "שמור"}
        </button>
      </div>

      <AppModal open={addOpen} onClose={() => setAddOpen(false)} title="סוג השדה">
        <div className="vlt-group vlt-sheet-list">
          {(Object.keys(FIELD_KIND_LABELS) as VaultFieldKind[]).map((k) => (
            <button key={k} type="button" className="vlt-row" onClick={() => addField(k)}>
              <span className="vlt-row-text">
                <span className="vlt-row-title">{FIELD_KIND_LABELS[k]}</span>
              </span>
              <IconPlus className="vlt-row-chevron" />
            </button>
          ))}
        </div>
      </AppModal>

      {generatorFor !== null ? (
        <PasswordGenerator
          open
          onClose={() => setGeneratorFor(null)}
          onUse={(pw) => {
            updateField(generatorFor, { value: pw });
            setRevealed((r) => ({ ...r, [generatorFor]: true }));
            setGeneratorFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

// ─── Password generator ───────────────────────────────────────────────────────

function PasswordGenerator(props: { open: boolean; onClose: () => void; onUse: (pw: string) => void }) {
  const [opts, setOpts] = useState({ length: 20, digits: true, symbols: true });
  const [value, setValue] = useState(() => generatePassword(opts));

  function update(patch: Partial<typeof opts>) {
    const next = { ...opts, ...patch };
    setOpts(next);
    setValue(generatePassword(next));
  }

  return (
    <AppModal open={props.open} onClose={props.onClose} title="סיסמה חזקה">
      <div className="vlt-gen">
        <div className="vlt-gen-value" dir="ltr">{value}</div>
        <button type="button" className="vlt-secondary" onClick={() => setValue(generatePassword(opts))}>
          <IconRefresh className="h-5 w-5" />
          סיסמה אחרת
        </button>
        <div className="vlt-group">
          <label className="vlt-gen-row">
            <span>אורך</span>
            <input type="range" min={8} max={40} value={opts.length} onChange={(e) => update({ length: Number(e.target.value) })} />
            <span className="vlt-gen-num">{opts.length}</span>
          </label>
          <label className="vlt-gen-row">
            <span>מספרים</span>
            <input type="checkbox" className="vlt-toggle" checked={opts.digits} onChange={(e) => update({ digits: e.target.checked })} />
          </label>
          <label className="vlt-gen-row">
            <span>סימנים</span>
            <input type="checkbox" className="vlt-toggle" checked={opts.symbols} onChange={(e) => update({ symbols: e.target.checked })} />
          </label>
        </div>
        <button type="button" className="btn btn-primary vlt-cta" onClick={() => props.onUse(value)}>
          השתמש בסיסמה
        </button>
      </div>
    </AppModal>
  );
}

