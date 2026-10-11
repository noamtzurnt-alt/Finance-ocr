"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  label?: string;
  wide?: boolean;
  children: React.ReactNode;
  className?: string;
};

export default function AppModal({
  open,
  onClose,
  title,
  label,
  wide,
  children,
  className,
}: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep scroll lock tied only to `open` so parent re-renders (new onClose identity)
  // don't re-capture scrollY as 0 while the body is already position:fixed.
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      htmlOverflow: document.documentElement.style.overflow,
    };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.classList.add("nf-modal-open");

    const vv = window.visualViewport;
    const sync = () => {
      const root = document.documentElement;
      if (!vv) {
        root.style.setProperty("--modal-vv-offset", "0px");
        return;
      }
      const offset = Math.round(vv.offsetTop + (vv.height - window.innerHeight) / 2);
      root.style.setProperty("--modal-vv-offset", `${offset}px`);
    };
    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);

    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.paddingRight = prev.paddingRight;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.documentElement.style.overflow = prev.htmlOverflow;
      document.documentElement.classList.remove("nf-modal-open");
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--modal-vv-offset");
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="nf-modal-backdrop nf-modal-backdrop--center nf-modal-backdrop--blur"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`nf-modal nf-modal--portal${wide ? " nf-modal--sheet" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="nf-modal-head">
            <h3 id={titleId} className="nf-modal-title">
              {title}
            </h3>
            <button type="button" className="tx-detail-close" onClick={onClose} aria-label="סגור">
              ✕
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
