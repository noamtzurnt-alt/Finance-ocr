"use client";

import { useEffect, useRef, useState } from "react";

export type MenuItem = {
  label: string;
  icon: (p: { className?: string }) => React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

const LONG_PRESS_MS = 450;

export function PressableRow(props: {
  className: string;
  onTap: (rect: DOMRect) => void;
  onLongPress?: (rect: DOMRect) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const [pressing, setPressing] = useState(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPressing(false);
  };

  const rect = () => ref.current?.getBoundingClientRect() ?? new DOMRect();

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      className={`${props.className} notes-pressable${pressing ? " is-pressing" : ""}`}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        fired.current = false;
        if (!props.onLongPress) return;
        start.current = { x: e.clientX, y: e.clientY };
        setPressing(true);
        timer.current = setTimeout(() => {
          fired.current = true;
          setPressing(false);
          props.onLongPress?.(rect());
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        if (!timer.current) return;
        if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        if (fired.current || !props.onLongPress) return;
        cancel();
        fired.current = true;
        props.onLongPress(rect());
      }}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        props.onTap(rect());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onTap(rect());
        }
      }}
    >
      {props.children}
    </div>
  );
}

export function PressMenu(props: { anchor: DOMRect; title: string; items: MenuItem[]; onClose: () => void }) {
  const { anchor } = props;
  const vw = typeof window === "undefined" ? 390 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const width = Math.min(250, vw - 32);
  const menuH = props.items.length * 48 + 8;
  const below = anchor.bottom + 8 + menuH < vh - 16;
  const top = below ? anchor.bottom + 8 : Math.max(16, anchor.top - 8 - menuH);
  const right = Math.min(Math.max(16, vw - anchor.right), vw - width - 16);
  const previewTop = Math.min(Math.max(16, anchor.top), vh - anchor.height - 16);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="notes-menu-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="notes-menu-preview"
        style={{ top: previewTop, left: anchor.left, width: anchor.width, minHeight: anchor.height }}
        aria-hidden
      >
        {props.title}
      </div>
      <div
        className="notes-menu"
        role="menu"
        aria-label={props.title}
        style={{ top, right, width, transformOrigin: below ? "top right" : "bottom right" }}
        onClick={(e) => e.stopPropagation()}
      >
        {props.items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`notes-menu-item${item.danger ? " is-danger" : ""}`}
              onClick={() => {
                props.onClose();
                item.onSelect();
              }}
            >
              <span>{item.label}</span>
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
