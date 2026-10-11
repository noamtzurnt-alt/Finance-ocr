"use client";

import { useRef, useState } from "react";
import { formatDue, isOverdue } from "@/app/lib/reminders/dates";
import type { ReminderDto } from "@/app/lib/reminders/types";
import { IconTrash } from "@/app/ui/icons";
import { IconFlag, IconIndent, IconInfo, IconLink, IconOutdent, IconRepeat } from "./icons";

const ACTION_W = 72;
const LONG_PRESS_MS = 480;
const EDGE_GUARD_PX = 22;

type Side = "trailing" | "leading" | null;

export default function ReminderRow(props: {
  r: ReminderDto;
  color: string;
  depth: number;
  listLabel?: string;
  subCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  open: Side;
  onOpenChange: (side: Side) => void;
  canIndent: boolean;
  onToggle: () => void;
  onDetails: () => void;
  onDelete: () => void;
  onFlag: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onLongPress: (rect: DOMRect) => void;
}) {
  const { r } = props;
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const mode = useRef<"idle" | "swipe" | "scroll">("idle");
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const swiped = useRef(false);
  const [dx, setDx] = useState<number | null>(null);

  const trailingW = ACTION_W * 3;
  const leadingW = ACTION_W;
  const rest = props.open === "trailing" ? trailingW : props.open === "leading" ? -leadingW : 0;
  const offset = dx ?? rest;

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const overdue = !r.completed && isOverdue(r.dueDate, r.dueTime);
  const due = formatDue(r.dueDate, r.dueTime);
  const host = r.url ? r.url.replace(/^https?:\/\//, "").split("/")[0] : "";
  const noteLine = r.notes.split("\n").find((l) => l.trim()) ?? "";

  return (
    <div
      className={`rem-row-wrap${r.completed ? " is-done" : ""}`}
      style={{ "--list": props.color, "--depth": props.depth } as React.CSSProperties}
    >
      <div className="rem-row-actions is-trailing" aria-hidden={props.open !== "trailing"}>
        <button type="button" className="rem-act is-info" onClick={props.onDetails}>
          <IconInfo className="h-5 w-5" />
          <span>פרטים</span>
        </button>
        <button type="button" className="rem-act is-flag" onClick={props.onFlag}>
          <IconFlag className="h-5 w-5" filled={!r.flagged} />
          <span>{r.flagged ? "הסר דגל" : "דגל"}</span>
        </button>
        <button type="button" className="rem-act is-delete" onClick={props.onDelete}>
          <IconTrash className="h-5 w-5" />
          <span>מחק</span>
        </button>
      </div>
      <div className="rem-row-actions is-leading" aria-hidden={props.open !== "leading"}>
        <button
          type="button"
          className="rem-act is-indent"
          onClick={r.parentId ? props.onOutdent : props.onIndent}
          disabled={!r.parentId && !props.canIndent}
        >
          {r.parentId ? <IconOutdent className="h-5 w-5" /> : <IconIndent className="h-5 w-5" />}
          <span>{r.parentId ? "הוצא" : "הזחה"}</span>
        </button>
      </div>

      <div
        ref={ref}
        className={`rem-row${dx !== null ? " is-dragging" : ""}`}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if ((e.target as HTMLElement).closest(".rem-check, .rem-collapse")) return;
          if (e.clientX < EDGE_GUARD_PX || e.clientX > window.innerWidth - EDGE_GUARD_PX) return;
          start.current = { x: e.clientX, y: e.clientY, base: rest };
          mode.current = "idle";
          pressed.current = false;
          clearPress();
          pressTimer.current = setTimeout(() => {
            if (mode.current !== "idle") return;
            pressed.current = true;
            start.current = null;
            if (ref.current) props.onLongPress(ref.current.getBoundingClientRect());
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (mode.current === "idle") {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
              mode.current = "scroll";
              clearPress();
              return;
            }
            if (Math.abs(mx) > 10) {
              mode.current = "swipe";
              clearPress();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }
          }
          if (mode.current !== "swipe") return;
          const raw = s.base + mx;
          const max = (ref.current?.offsetWidth ?? 360) * 0.9;
          setDx(Math.max(-leadingW * 1.6, Math.min(max, raw)));
        }}
        onPointerUp={() => {
          clearPress();
          const s = start.current;
          start.current = null;
          if (mode.current !== "swipe" || dx === null || !s) {
            setDx(null);
            return;
          }
          const width = ref.current?.offsetWidth ?? 360;
          const value = dx;
          setDx(null);
          mode.current = "idle";
          swiped.current = true;
          setTimeout(() => {
            swiped.current = false;
          }, 80);
          if (value > width * 0.62) {
            props.onDelete();
            props.onOpenChange(null);
          } else if (value > trailingW * 0.45) props.onOpenChange("trailing");
          else if (value < -leadingW * 1.3 && (r.parentId || props.canIndent)) {
            if (r.parentId) props.onOutdent();
            else props.onIndent();
            props.onOpenChange(null);
          } else if (value < -leadingW * 0.5) props.onOpenChange("leading");
          else props.onOpenChange(null);
        }}
        onPointerCancel={() => {
          clearPress();
          start.current = null;
          mode.current = "idle";
          setDx(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!pressed.current && ref.current) props.onLongPress(ref.current.getBoundingClientRect());
        }}
        onClick={() => {
          if (pressed.current) {
            pressed.current = false;
            return;
          }
          if (mode.current === "swipe" || swiped.current) return;
          if (props.open) {
            props.onOpenChange(null);
            return;
          }
          props.onDetails();
        }}
      >
        <button
          type="button"
          className={`rem-check${r.completed ? " is-on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle();
          }}
          aria-label={r.completed ? "סמן כלא בוצע" : "סמן כבוצע"}
          aria-pressed={r.completed}
        >
          <span className="rem-check-dot" />
        </button>

        <div className="rem-row-main">
          <div className="rem-row-title">
            {r.priority > 0 ? <span className="rem-prio">{"!".repeat(r.priority)}</span> : null}
            <span className="rem-row-text">{r.title || "תזכורת חדשה"}</span>
          </div>
          {noteLine ? <div className="rem-row-notes">{noteLine}</div> : null}
          {due || r.recurrence || host || r.tags.length || props.listLabel ? (
            <div className="rem-row-meta">
              {props.listLabel ? <span className="rem-meta-list">{props.listLabel}</span> : null}
              {due ? <span className={overdue ? "is-overdue" : undefined}>{due}</span> : null}
              {r.recurrence ? <IconRepeat className="rem-meta-icon" /> : null}
              {host ? (
                <span className="rem-meta-link">
                  <IconLink className="rem-meta-icon" />
                  {host}
                </span>
              ) : null}
              {r.tags.map((t) => (
                <span key={t} className="rem-meta-tag">
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {r.flagged ? <IconFlag className="rem-row-flag" filled /> : null}
        {props.subCount > 0 ? (
          <button
            type="button"
            className={`rem-collapse${props.collapsed ? " is-collapsed" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleCollapse();
            }}
            aria-label={props.collapsed ? `הצג ${props.subCount} תתי־משימות` : "הסתר תתי־משימות"}
          >
            <span>{props.subCount}</span>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
