"use client";

import { useState } from "react";
import { LIST_COLORS, SORT_LABELS, type ReminderListDto, type SortMode } from "@/app/lib/reminders/types";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@/app/ui/icons";
import { IconCheckCircle, IconColumns, LIST_ICON_KEYS, ListGlyph } from "./icons";
import Sheet from "./Sheet";

export type ListDraft = Pick<ReminderListDto, "name" | "color" | "icon" | "kind">;

export function ListEditorSheet(props: {
  initial: ListDraft | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (draft: ListDraft) => void;
}) {
  const [draft, setDraft] = useState<ListDraft>(
    props.initial ?? { name: "", color: "blue", icon: "list", kind: "standard" },
  );
  const color = LIST_COLORS[draft.color] ?? LIST_COLORS.blue;
  const canSave = draft.name.trim().length > 0;

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={props.isNew ? "רשימה חדשה" : "עריכת רשימה"}
      start={
        <button type="button" className="rem-sheet-cancel" onClick={props.onClose}>
          ביטול
        </button>
      }
      end={
        <button
          type="button"
          className="rem-sheet-done"
          disabled={!canSave}
          onClick={() => props.onSave({ ...draft, name: draft.name.trim() })}
        >
          {props.isNew ? "הוסף" : "סיום"}
        </button>
      }
    >
      <div className="rem-group rem-list-hero">
        <span className="rem-list-badge is-xl" style={{ background: color, boxShadow: `0 10px 30px ${color}55` }}>
          <ListGlyph icon={draft.icon} className="h-10 w-10" />
        </span>
        <input
          className="rem-list-name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="שם הרשימה"
          maxLength={80}
          style={{ color }}
          autoFocus={props.isNew}
          aria-label="שם הרשימה"
        />
      </div>

      <div className="rem-group">
        <div className="rem-seg is-wide" role="radiogroup" aria-label="סוג רשימה">
          {(["standard", "groceries"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={draft.kind === k}
              className={`rem-seg-btn${draft.kind === k ? " is-on" : ""}`}
              onClick={() => setDraft((d) => ({ ...d, kind: k, icon: k === "groceries" && d.icon === "list" ? "cart" : d.icon }))}
            >
              {k === "standard" ? "רגילה" : "קניות"}
            </button>
          ))}
        </div>
        {draft.kind === "groceries" ? (
          <p className="rem-hint">פריטים ימוינו אוטומטית לפי מחלקות בסופר: ירקות, חלב, מאפים, ניקיון ועוד.</p>
        ) : null}
      </div>

      <div className="rem-group">
        <div className="rem-swatches" role="radiogroup" aria-label="צבע">
          {Object.entries(LIST_COLORS).map(([key, hex]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={draft.color === key}
              aria-label={key}
              className={`rem-swatch${draft.color === key ? " is-on" : ""}`}
              style={{ background: hex, "--ring": hex } as React.CSSProperties}
              onClick={() => setDraft((d) => ({ ...d, color: key }))}
            />
          ))}
        </div>
      </div>

      <div className="rem-group">
        <div className="rem-icon-grid" role="radiogroup" aria-label="אייקון">
          {LIST_ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={draft.icon === key}
              aria-label={key}
              className={`rem-icon-pick${draft.icon === key ? " is-on" : ""}`}
              style={{ "--list": color } as React.CSSProperties}
              onClick={() => setDraft((d) => ({ ...d, icon: key }))}
            >
              <ListGlyph icon={key} className="h-5.5 w-5.5" />
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

export function ListOptionsSheet(props: {
  list: ReminderListDto;
  completedCount: number;
  onClose: () => void;
  onUpdate: (patch: Partial<ReminderListDto>) => void;
  onEdit: () => void;
  onAddSection: (name: string) => void;
  onClearCompleted: () => void;
  onDelete: () => void;
}) {
  const { list } = props;
  const [sectionName, setSectionName] = useState("");
  const [adding, setAdding] = useState(false);

  return (
    <Sheet open onClose={props.onClose} title={list.name}>
      <div className="rem-group">
        <button type="button" className="rem-option" onClick={props.onEdit}>
          <IconPencil className="h-5 w-5" />
          <span>עריכת שם, צבע ואייקון</span>
        </button>
        {list.kind !== "groceries" ? (
          adding ? (
            <form
              className="rem-option"
              onSubmit={(e) => {
                e.preventDefault();
                if (sectionName.trim()) props.onAddSection(sectionName.trim());
                setSectionName("");
                setAdding(false);
              }}
            >
              <IconPlus className="h-5 w-5" />
              <input
                className="rem-option-input"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="שם הסקשן"
                autoFocus
                maxLength={80}
              />
              <button type="submit" className="rem-sheet-done" disabled={!sectionName.trim()}>
                הוסף
              </button>
            </form>
          ) : (
            <button type="button" className="rem-option" onClick={() => setAdding(true)}>
              <IconPlus className="h-5 w-5" />
              <span>סקשן חדש</span>
            </button>
          )
        ) : null}
        {list.kind !== "groceries" ? (
          <button
            type="button"
            className="rem-option"
            onClick={() => props.onUpdate({ viewMode: list.viewMode === "columns" ? "list" : "columns" })}
          >
            <IconColumns className="h-5 w-5" />
            <span>{list.viewMode === "columns" ? "הצג כרשימה" : "הצג כעמודות"}</span>
          </button>
        ) : null}
        <button type="button" className="rem-option" onClick={() => props.onUpdate({ showCompleted: !list.showCompleted })}>
          <IconCheckCircle className="h-5 w-5" />
          <span>{list.showCompleted ? "הסתר שהושלמו" : "הצג שהושלמו"}</span>
        </button>
      </div>

      <div className="rem-group">
        <div className="rem-group-title">מיון לפי</div>
        {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
          <button key={m} type="button" className="rem-option" onClick={() => props.onUpdate({ sortMode: m })}>
            <span className="rem-option-check">{list.sortMode === m ? <IconCheck className="h-5 w-5" /> : null}</span>
            <span>{SORT_LABELS[m]}</span>
          </button>
        ))}
      </div>

      <div className="rem-group">
        <button
          type="button"
          className="rem-option is-danger"
          disabled={props.completedCount === 0}
          onClick={() => {
            props.onClearCompleted();
            props.onClose();
          }}
        >
          <IconTrash className="h-5 w-5" />
          <span>נקה {props.completedCount ? `${props.completedCount} ` : ""}שהושלמו</span>
        </button>
        <button
          type="button"
          className="rem-option is-danger"
          onClick={() => {
            if (confirm(`למחוק את הרשימה "${list.name}" וכל התזכורות שבה?`)) props.onDelete();
          }}
        >
          <IconTrash className="h-5 w-5" />
          <span>מחק רשימה</span>
        </button>
      </div>
    </Sheet>
  );
}
