"use client";

import { useState } from "react";
import { todayIso, WEEKDAYS, WEEKDAYS_SHORT } from "@/app/lib/reminders/dates";
import { describeRecurrence } from "@/app/lib/reminders/recurrence";
import {
  EARLY_OPTIONS,
  LIST_COLORS,
  PRIORITY_LABELS,
  type Recurrence,
  type ReminderDto,
} from "@/app/lib/reminders/types";
import { IconPlus, IconTrash } from "@/app/ui/icons";
import { IconCalendar, IconClock, IconFlag, IconLink, IconRepeat, IconTag, ListGlyph } from "./icons";
import Sheet from "./Sheet";
import type { RemindersStore } from "./useRemindersStore";

type RepeatPreset = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly" | "custom";

function presetOf(r: Recurrence | null): RepeatPreset {
  if (!r) return "none";
  const plain = !r.weekdays?.length && !r.monthWeek && !r.until && !r.count;
  if (plain && r.interval === 1) return r.freq === "daily" ? "daily" : r.freq === "weekly" ? "weekly" : r.freq === "monthly" ? "monthly" : "yearly";
  if (plain && r.interval === 2 && r.freq === "weekly") return "biweekly";
  return "custom";
}

const PRESETS: Array<[RepeatPreset, string]> = [
  ["none", "אף פעם"],
  ["daily", "כל יום"],
  ["weekly", "כל שבוע"],
  ["biweekly", "כל שבועיים"],
  ["monthly", "כל חודש"],
  ["yearly", "כל שנה"],
  ["custom", "מותאם אישית…"],
];

function Toggle(props: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      className={`rem-switch${props.on ? " is-on" : ""}`}
      onClick={() => props.onChange(!props.on)}
    >
      <span />
    </button>
  );
}

export default function DetailSheet(props: { store: RemindersStore; id: string | null; onClose: () => void }) {
  const { store } = props;
  const r = props.id ? store.reminders.find((x) => x.id === props.id) : undefined;
  const [tagDraft, setTagDraft] = useState("");
  const [subDraft, setSubDraft] = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  if (!r) return <Sheet open={false} onClose={props.onClose} title="">{null}</Sheet>;

  const list = store.lists.find((l) => l.id === r.listId);
  const color = LIST_COLORS[list?.color ?? "blue"] ?? LIST_COLORS.blue;
  const listSections = store.sections.filter((s) => s.listId === r.listId);
  const subs = store.reminders.filter((x) => x.parentId === r.id).sort((a, b) => a.position - b.position);
  const set = (patch: Partial<ReminderDto>) => store.updateReminder(r.id, patch);
  const rule = r.recurrence;

  function setPreset(p: RepeatPreset) {
    const map: Record<Exclude<RepeatPreset, "none" | "custom">, Recurrence> = {
      daily: { freq: "daily", interval: 1 },
      weekly: { freq: "weekly", interval: 1 },
      biweekly: { freq: "weekly", interval: 2 },
      monthly: { freq: "monthly", interval: 1 },
      yearly: { freq: "yearly", interval: 1 },
    };
    if (p === "none") set({ recurrence: null });
    else if (p === "custom") {
      setCustomOpen(true);
      if (!rule) set({ recurrence: { freq: "weekly", interval: 1 }, dueDate: r!.dueDate ?? todayIso() });
    } else set({ recurrence: map[p], dueDate: r!.dueDate ?? todayIso() });
  }

  function setRule(patch: Partial<Recurrence>) {
    set({ recurrence: { ...(rule ?? { freq: "weekly", interval: 1 }), ...patch } });
  }

  function addTag() {
    const t = tagDraft.trim().replace(/^#/, "");
    if (t && !r!.tags.includes(t)) set({ tags: [...r!.tags, t] });
    setTagDraft("");
  }

  function addSub() {
    const title = subDraft.trim();
    if (!title) return;
    store.createReminder({ listId: r!.listId, parentId: r!.id, title });
    setSubDraft("");
  }

  return (
    <Sheet
      open
      tall
      onClose={props.onClose}
      title="פרטים"
      end={
        <button type="button" className="rem-sheet-done" onClick={props.onClose}>
          סיום
        </button>
      }
    >
      <div className="rem-group" style={{ "--list": color } as React.CSSProperties}>
        <input
          className="rem-detail-title"
          value={r.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="כותרת"
          aria-label="כותרת"
        />
        <textarea
          className="rem-detail-notes"
          value={r.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="הערות"
          aria-label="הערות"
          rows={3}
        />
        <label className="rem-field">
          <IconLink className="rem-field-icon" />
          <input
            className="rem-field-input"
            value={r.url}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="קישור"
            inputMode="url"
            dir="ltr"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
      </div>

      <div className="rem-group">
        <div className="rem-cell">
          <span className="rem-cell-icon is-red">
            <IconCalendar className="h-4.5 w-4.5" />
          </span>
          <span className="rem-cell-label">תאריך</span>
          {r.dueDate ? (
            <input
              type="date"
              className="rem-cell-picker"
              value={r.dueDate}
              onChange={(e) => e.target.value && set({ dueDate: e.target.value })}
            />
          ) : null}
          <Toggle
            label="תאריך"
            on={Boolean(r.dueDate)}
            onChange={(v) => set(v ? { dueDate: todayIso() } : { dueDate: null, dueTime: null, recurrence: null, earlyMinutes: null })}
          />
        </div>
        <div className="rem-cell">
          <span className="rem-cell-icon is-blue">
            <IconClock className="h-4.5 w-4.5" />
          </span>
          <span className="rem-cell-label">שעה</span>
          {r.dueTime ? (
            <input
              type="time"
              className="rem-cell-picker"
              value={r.dueTime}
              onChange={(e) => e.target.value && set({ dueTime: e.target.value })}
            />
          ) : null}
          <Toggle
            label="שעה"
            on={Boolean(r.dueTime)}
            onChange={(v) => {
              if (!v) return set({ dueTime: null, earlyMinutes: null });
              const h = new Date().getHours() + 1;
              set({ dueTime: `${String(Math.min(h, 23)).padStart(2, "0")}:00`, dueDate: r.dueDate ?? todayIso() });
            }}
          />
        </div>
        {r.dueDate && r.dueTime ? (
          <label className="rem-cell">
            <span className="rem-cell-icon is-purple">
              <IconClock className="h-4.5 w-4.5" />
            </span>
            <span className="rem-cell-label">התראה מוקדמת</span>
            <select
              className="rem-cell-select"
              value={r.earlyMinutes ?? ""}
              onChange={(e) => set({ earlyMinutes: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">ללא</option>
              {EARLY_OPTIONS.map((o) => (
                <option key={o.minutes} value={o.minutes}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="rem-cell">
          <span className="rem-cell-icon is-gray">
            <IconRepeat className="h-4.5 w-4.5" />
          </span>
          <span className="rem-cell-label">חזרה</span>
          <select
            className="rem-cell-select"
            value={presetOf(rule)}
            onChange={(e) => setPreset(e.target.value as RepeatPreset)}
          >
            {PRESETS.map(([k, label]) => (
              <option key={k} value={k}>
                {k === "custom" && presetOf(rule) === "custom" ? describeRecurrence(rule) : label}
              </option>
            ))}
          </select>
        </label>
        {rule && (customOpen || presetOf(rule) === "custom") ? (
          <div className="rem-custom">
            <div className="rem-custom-row">
              <span>כל</span>
              <input
                type="number"
                min={1}
                max={365}
                className="rem-num"
                value={rule.interval}
                onChange={(e) => setRule({ interval: Math.max(1, Number(e.target.value) || 1) })}
                aria-label="מרווח"
              />
              <select
                className="rem-cell-select"
                value={rule.freq}
                onChange={(e) =>
                  setRule({ freq: e.target.value as Recurrence["freq"], weekdays: undefined, monthWeek: undefined })
                }
              >
                <option value="daily">ימים</option>
                <option value="weekly">שבועות</option>
                <option value="monthly">חודשים</option>
                <option value="yearly">שנים</option>
              </select>
            </div>
            {rule.freq === "weekly" ? (
              <div className="rem-days" role="group" aria-label="ימים בשבוע">
                {WEEKDAYS_SHORT.map((d, i) => {
                  const on = rule.weekdays?.includes(i) ?? false;
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`rem-day${on ? " is-on" : ""}`}
                      aria-pressed={on}
                      aria-label={`יום ${WEEKDAYS[i]}`}
                      onClick={() => {
                        const cur = rule.weekdays ?? [];
                        setRule({ weekdays: on ? cur.filter((x) => x !== i) : [...cur, i] });
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {rule.freq === "monthly" ? (
              <div className="rem-custom-row">
                <select
                  className="rem-cell-select"
                  value={rule.monthWeek ? "nth" : "date"}
                  onChange={(e) =>
                    setRule({
                      monthWeek:
                        e.target.value === "nth"
                          ? { nth: 1, weekday: new Date(`${r.dueDate ?? todayIso()}T12:00`).getDay() }
                          : undefined,
                    })
                  }
                >
                  <option value="date">באותו תאריך</option>
                  <option value="nth">ביום מסוים בשבוע</option>
                </select>
                {rule.monthWeek ? (
                  <>
                    <select
                      className="rem-cell-select"
                      value={rule.monthWeek.nth}
                      onChange={(e) => setRule({ monthWeek: { ...rule.monthWeek!, nth: Number(e.target.value) } })}
                    >
                      <option value={1}>הראשון</option>
                      <option value={2}>השני</option>
                      <option value={3}>השלישי</option>
                      <option value={4}>הרביעי</option>
                      <option value={-1}>האחרון</option>
                    </select>
                    <select
                      className="rem-cell-select"
                      value={rule.monthWeek.weekday}
                      onChange={(e) => setRule({ monthWeek: { ...rule.monthWeek!, weekday: Number(e.target.value) } })}
                    >
                      {WEEKDAYS.map((d, i) => (
                        <option key={d} value={i}>
                          יום {d}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="rem-custom-row">
              <span>סיום</span>
              <select
                className="rem-cell-select"
                value={rule.until ? "date" : rule.count ? "count" : "never"}
                onChange={(e) =>
                  setRule(
                    e.target.value === "date"
                      ? { until: r.dueDate ?? todayIso(), count: null }
                      : e.target.value === "count"
                        ? { count: 10, until: null }
                        : { until: null, count: null },
                  )
                }
              >
                <option value="never">אף פעם</option>
                <option value="date">בתאריך</option>
                <option value="count">אחרי מספר פעמים</option>
              </select>
              {rule.until ? (
                <input
                  type="date"
                  className="rem-cell-picker"
                  value={rule.until}
                  onChange={(e) => e.target.value && setRule({ until: e.target.value })}
                />
              ) : null}
              {rule.count ? (
                <input
                  type="number"
                  min={1}
                  className="rem-num"
                  value={rule.count}
                  onChange={(e) => setRule({ count: Math.max(1, Number(e.target.value) || 1) })}
                  aria-label="מספר פעמים"
                />
              ) : null}
            </div>
            <p className="rem-custom-sum">{describeRecurrence(rule)}</p>
          </div>
        ) : null}
      </div>

      <div className="rem-group">
        <div className="rem-cell">
          <span className="rem-cell-icon is-orange">
            <IconFlag className="h-4.5 w-4.5" filled />
          </span>
          <span className="rem-cell-label">דגל</span>
          <Toggle label="דגל" on={r.flagged} onChange={(v) => set({ flagged: v })} />
        </div>
        <div className="rem-cell">
          <span className="rem-cell-icon is-red">
            <span className="rem-cell-bang">!</span>
          </span>
          <span className="rem-cell-label">עדיפות</span>
          <div className="rem-seg" role="radiogroup" aria-label="עדיפות">
            {PRIORITY_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={r.priority === i}
                className={`rem-seg-btn${r.priority === i ? " is-on" : ""}`}
                onClick={() => set({ priority: i })}
              >
                {i === 0 ? label : "!".repeat(i)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rem-group">
        <div className="rem-cell is-wrap">
          <span className="rem-cell-icon is-gray">
            <IconTag className="h-4.5 w-4.5" />
          </span>
          <span className="rem-cell-label">תגיות</span>
          <div className="rem-tags">
            {r.tags.map((t) => (
              <button
                key={t}
                type="button"
                className="rem-chip is-removable"
                onClick={() => set({ tags: r.tags.filter((x) => x !== t) })}
                aria-label={`הסר תגית ${t}`}
              >
                #{t} <span aria-hidden>×</span>
              </button>
            ))}
            <input
              className="rem-tag-input"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="הוסף תגית"
            />
          </div>
        </div>
      </div>

      <div className="rem-group">
        <label className="rem-cell">
          <span className="rem-cell-icon" style={{ background: color }}>
            <ListGlyph icon={list?.icon ?? "list"} className="h-4.5 w-4.5" />
          </span>
          <span className="rem-cell-label">רשימה</span>
          <select
            className="rem-cell-select"
            value={r.listId}
            onChange={(e) => set({ listId: e.target.value, sectionId: null, parentId: null })}
          >
            {store.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {listSections.length > 0 && list?.kind !== "groceries" ? (
          <label className="rem-cell">
            <span className="rem-cell-icon is-gray">
              <ListGlyph icon="list" className="h-4.5 w-4.5" />
            </span>
            <span className="rem-cell-label">סקשן</span>
            <select
              className="rem-cell-select"
              value={r.sectionId ?? ""}
              onChange={(e) => set({ sectionId: e.target.value || null })}
            >
              <option value="">ללא</option>
              {listSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {!r.parentId ? (
        <div className="rem-group" style={{ "--list": color } as React.CSSProperties}>
          <div className="rem-group-title">תתי־משימות</div>
          {subs.map((s) => (
            <div key={s.id} className="rem-sub">
              <button
                type="button"
                className={`rem-check${s.completed ? " is-on" : ""}`}
                onClick={() => store.toggleComplete(s.id)}
                aria-label={s.completed ? "סמן כלא בוצע" : "סמן כבוצע"}
              >
                <span className="rem-check-dot" />
              </button>
              <input
                className="rem-sub-input"
                value={s.title}
                onChange={(e) => store.updateReminder(s.id, { title: e.target.value })}
                aria-label="תת־משימה"
              />
              <button type="button" className="rem-sub-del" onClick={() => store.deleteReminder(s.id)} aria-label="מחק">
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="rem-sub">
            <span className="rem-add-icon">
              <IconPlus className="h-4 w-4" />
            </span>
            <input
              className="rem-sub-input"
              value={subDraft}
              onChange={(e) => setSubDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSub();
                }
              }}
              onBlur={addSub}
              placeholder="הוסף תת־משימה"
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="rem-danger-btn"
        onClick={() => {
          store.deleteReminder(r.id);
          props.onClose();
        }}
      >
        <IconTrash className="h-4.5 w-4.5" />
        מחק תזכורת
      </button>
    </Sheet>
  );
}
