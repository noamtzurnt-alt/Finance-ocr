"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/app/ui/icons";

const DISMISS_PX = 110;

export default function Sheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  start?: React.ReactNode;
  end?: React.ReactNode;
  tall?: boolean;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const onCloseRef = useRef(props.onClose);
  useEffect(() => {
    onCloseRef.current = props.onClose;
  });

  useEffect(() => {
    if (!props.open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [props.open]);

  if (!props.open || typeof document === "undefined") return null;

  return createPortal(
    <div className="rem-sheet-backdrop" onClick={props.onClose} role="presentation">
      <div
        className={`rem-sheet${props.tall ? " is-tall" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(e) => e.stopPropagation()}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
      >
        <div
          className="rem-sheet-head"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            startY.current = e.clientY;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (startY.current === null) return;
            setDrag(Math.max(0, e.clientY - startY.current));
          }}
          onPointerUp={() => {
            if (startY.current === null) return;
            startY.current = null;
            if (drag > DISMISS_PX) props.onClose();
            setDrag(0);
          }}
          onPointerCancel={() => {
            startY.current = null;
            setDrag(0);
          }}
        >
          <span className="rem-sheet-grabber" aria-hidden />
          <div className="rem-sheet-bar">
            <div className="rem-sheet-side">
              {props.start ?? (
                <button type="button" className="rem-sheet-x" onClick={props.onClose} aria-label="סגור">
                  <IconClose className="h-4 w-4" />
                </button>
              )}
            </div>
            <h2 className="rem-sheet-title">{props.title}</h2>
            <div className="rem-sheet-side is-end">{props.end}</div>
          </div>
        </div>
        <div className="rem-sheet-body">{props.children}</div>
      </div>
    </div>,
    document.body,
  );
}
