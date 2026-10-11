"use client";

import { useRef, useState } from "react";
import { addDays, formatDue, todayIso } from "@/app/lib/reminders/dates";
import { parseQuick } from "@/app/lib/reminders/nlp";
import type { ReminderDto } from "@/app/lib/reminders/types";
import { IconPlus } from "@/app/ui/icons";
import { IconCalendar, IconFlag, IconTag } from "./icons";

export type QuickDefaults = Partial<Pick<ReminderDto, "dueDate" | "flagged" | "sectionId" | "tags">>;

export default function QuickAdd(props: {
  color: string;
  defaults?: QuickDefaults;
  onAdd: (input: Partial<ReminderDto> & { title: string }) => void;
  label?: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(props.autoOpen));
  const [text, setText] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [priority, setPriority] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const parsed = parseQuick(text);
  const dueDate = date ?? parsed.dueDate ?? props.defaults?.dueDate ?? null;
  const effectivePriority = priority ?? parsed.priority;

  function reset() {
    setText("");
    setFlagged(false);
    setPriority(null);
    setDate(null);
  }

  function submit() {
    const title = parsed.title.trim();
    if (!title) return;
    props.onAdd({
      title,
      dueDate,
      dueTime: parsed.dueTime,
      priority: effectivePriority,
      tags: [...new Set([...(props.defaults?.tags ?? []), ...parsed.tags])],
      recurrence: parsed.recurrence,
      flagged: flagged || Boolean(props.defaults?.flagged),
      sectionId: props.defaults?.sectionId ?? null,
    });
    reset();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (!open) {
    return (
      <button
        type="button"
        className="rem-add"
        style={{ "--list": props.color } as React.CSSProperties}
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
          });
        }}
      >
        <span className="rem-add-icon">
          <IconPlus className="h-4 w-4" />
        </span>
        {props.label ?? "תזכורת חדשה"}
      </button>
    );
  }

  const chips = [
    ...(dueDate || parsed.dueTime ? [formatDue(dueDate, parsed.dueTime)] : []),
    ...(parsed.recurrence ? [parsed.hints.find((h) => h.startsWith("כל")) ?? "חוזר"] : []),
    ...(effectivePriority ? ["!".repeat(effectivePriority)] : []),
    ...parsed.tags.map((t) => `#${t}`),
    ...(flagged ? ["דגל"] : []),
  ];

  return (
    <div className="rem-quick" style={{ "--list": props.color } as React.CSSProperties}>
      <div className="rem-quick-row">
        <span className="rem-check" aria-hidden>
          <span className="rem-check-dot" />
        </span>
        <input
          ref={inputRef}
          className="rem-quick-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              reset();
              setOpen(false);
            }
          }}
          onBlur={(e) => {
            if (props.autoOpen) return;
            if ((e.relatedTarget as HTMLElement | null)?.closest(".rem-quick")) return;
            if (parsed.title.trim()) submit();
            setOpen(false);
          }}
          placeholder="לדוגמה: לקנות חלב מחר ב-5 #בית"
          enterKeyHint="done"
          autoFocus={props.autoOpen}
          aria-label="תזכורת חדשה"
        />
      </div>
      {chips.length ? (
        <div className="rem-quick-chips" aria-live="polite">
          {chips.map((c) => (
            <span key={c} className="rem-chip">
              {c}
            </span>
          ))}
        </div>
      ) : null}
      <div
        className="rem-quick-tools"
        role="toolbar"
        aria-label="הוספה מהירה"
        onPointerDown={(e) => {
          if (!(e.target as HTMLElement).closest("input")) e.preventDefault();
        }}
      >
        <button type="button" className={`rem-tool${date === todayIso() ? " is-on" : ""}`} onClick={() => setDate(todayIso())}>
          היום
        </button>
        <button
          type="button"
          className={`rem-tool${date === addDays(todayIso(), 1) ? " is-on" : ""}`}
          onClick={() => setDate(addDays(todayIso(), 1))}
        >
          מחר
        </button>
        <button
          type="button"
          className="rem-tool is-icon"
          aria-label="בחר תאריך"
          onClick={() => {
            const el = dateRef.current;
            if (el && "showPicker" in el) el.showPicker();
          }}
        >
          <IconCalendar className="h-[1.1rem] w-[1.1rem]" />
        </button>
        <input
          ref={dateRef}
          type="date"
          className="rem-hidden-date"
          tabIndex={-1}
          value={date ?? ""}
          onChange={(e) => setDate(e.target.value || null)}
        />
        <button
          type="button"
          className={`rem-tool is-icon${flagged ? " is-on is-flag" : ""}`}
          aria-label="דגל"
          aria-pressed={flagged}
          onClick={() => setFlagged((v) => !v)}
        >
          <IconFlag className="h-[1.1rem] w-[1.1rem]" filled={flagged} />
        </button>
        <button
          type="button"
          className={`rem-tool${effectivePriority ? " is-on" : ""}`}
          aria-label="עדיפות"
          onClick={() => setPriority(((effectivePriority + 1) % 4) as number)}
        >
          {effectivePriority ? "!".repeat(effectivePriority) : "!"}
        </button>
        <button
          type="button"
          className="rem-tool is-icon"
          aria-label="הוסף תגית"
          onClick={() => {
            setText((t) => (t.endsWith(" ") || !t ? `${t}#` : `${t} #`));
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <IconTag className="h-[1.1rem] w-[1.1rem]" />
        </button>
      </div>
    </div>
  );
}
