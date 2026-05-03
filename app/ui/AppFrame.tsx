"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import OcrWorkerRunner from "@/app/ui/OcrWorkerRunner";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type NavItem = {
  href: string;
  label: string;
  color: string; // tailwind bg color for active icon
  icon: (props: { className?: string }) => React.ReactNode;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    label: "דשבורד",
    color: "from-indigo-500 to-violet-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/transactions",
    label: "תנועות",
    color: "from-blue-500 to-cyan-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/invoices",
    label: "חשבוניות",
    color: "from-emerald-500 to-teal-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 3h7l3 3v15a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v4h4M8 11h8M8 15h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/receipts",
    label: "קבלות החזר מס",
    color: "from-amber-500 to-orange-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/payment-receipts",
    label: "קבלות על תשלום",
    color: "from-lime-500 to-green-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: "/investments",
    label: "השקעות",
    color: "from-pink-500 to-rose-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 17l6-6 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 7v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/budget",
    label: "תקציב",
    color: "from-purple-500 to-indigo-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/credentials",
    label: "סיסמאות",
    color: "from-slate-500 to-zinc-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 10V7a5 5 0 0 1 10 0v3" strokeLinecap="round" />
        <rect x="5" y="10" width="14" height="11" rx="1.5" />
        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/export",
    label: "ייצוא",
    color: "from-sky-500 to-blue-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v12M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 21h16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "הגדרות",
    color: "from-zinc-400 to-slate-500",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

function SidebarContent({ active, onClose }: { active: string; onClose?: () => void }) {
  return (
    <>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="currentColor">
            <path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2H2V4ZM2 8h16v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Zm4 3a1 1 0 0 0 0 2h4a1 1 0 0 0 0-2H6Z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white leading-tight">Finance OCR</div>
          <div className="text-[0.65rem] text-white/40 leading-tight">ניהול כספים</div>
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-section-label">תפריט</div>
      <nav className="sidebar-nav">
        {nav.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cx("nav-link", isActive && "nav-link-active")}
            >
              <span className={cx("nav-icon", isActive && "nav-icon-active", isActive && `bg-gradient-to-br ${item.color}`)}>
                {item.icon({ className: "h-4 w-4" })}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div className="px-3 pb-4 pt-1">
        <div className="rounded-xl bg-white/5 px-3 py-2.5 text-[0.72rem] leading-relaxed text-white/35">
          OCR → תיקון ידני → ייצוא לרו״ח
        </div>
      </div>
    </>
  );
}

export default function AppFrame(props: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const isPreview = sp?.get("preview") === "1";
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  const enableBrowserRunner =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_OCR_BROWSER_RUNNER === "1";

  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const spKey = sp?.toString() ?? "";

  const active = useMemo(() => {
    const direct = nav.find((n) => pathname.startsWith(n.href))?.href;
    if (direct) return direct;
    if (pathname.startsWith("/documents")) {
      const from = new URLSearchParams(spKey).get("from");
      if (from === "receipts") return "/receipts";
      if (from === "invoices") return "/invoices";
      if (from === "payment-receipts") return "/payment-receipts";
    }
    return "/dashboard";
  }, [pathname, spKey]);

  const previewUrl = useMemo(() => {
    const p = new URLSearchParams(sp?.toString());
    p.set("preview", "1");
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, sp]);

  const isTermsOrPrivacy = pathname === "/terms" || pathname === "/privacy";
  if (isAuthPage) return <>{props.children}</>;
  if (isTermsOrPrivacy) return <>{props.children}</>;

  return (
    <div className="app-shell">
      {enableBrowserRunner ? <OcrWorkerRunner intervalMs={2000} /> : null}

      {/* Top bar */}
      <div className="app-topbar">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="btn btn-ghost md:hidden"
            onClick={() => setOpen(true)}
            aria-label="פתח תפריט"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="brand-badge" aria-hidden />
            <span className="text-sm font-semibold tracking-tight text-zinc-900">Finance OCR</span>
          </Link>

          <div className="flex-1" />

          {!isPreview && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPreviewOpen(true)}
              title="תצוגת מובייל"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
                <path d="M11 19h2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Layout */}
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[260px_1fr]">
        {/* Sidebar desktop */}
        <aside className="hidden md:block">
          <div className="sidebar">
            <SidebarContent active={active} />
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          {props.children}
          <footer className="mt-10 border-t border-zinc-200/60 pt-4 pb-2 text-center text-xs text-zinc-400">
            <p className="mb-1">כלי עזר לניהול בלבד — האחריות על הדיווח לרשויות המס עליך ועל רואה החשבון שלך.</p>
            <p>
              <Link href="/terms" className="font-medium text-zinc-500 underline hover:text-zinc-700">תנאי שימוש</Link>
              {" · "}
              <Link href="/privacy" className="font-medium text-zinc-500 underline hover:text-zinc-700">פרטיות</Link>
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="סגור תפריט"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[82%] max-w-xs overflow-y-auto shadow-2xl"
               style={{ background: "var(--sidebar-bg)" }}>
            <div className="flex items-center justify-end px-3 pt-3">
              <button type="button" className="btn btn-ghost text-white/60 hover:text-white" onClick={() => setOpen(false)}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <SidebarContent active={active} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* iPhone preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="סגור תצוגה"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="absolute inset-x-0 top-8 mx-auto w-[min(980px,92vw)]">
            <div className="card card-soft overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200/70 bg-white/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="brand-badge" aria-hidden />
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">תצוגת מובייל</div>
                    <div className="text-xs text-zinc-500">iPhone 15 Pro (393×852)</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a className="btn" href={previewUrl} target="_blank" rel="noreferrer">פתח בטאב</a>
                  <button type="button" className="btn" onClick={() => setPreviewOpen(false)}>סגור</button>
                </div>
              </div>
              <div className="flex justify-center bg-zinc-50/40 p-6">
                <div className="device-iphone">
                  <div className="device-notch" aria-hidden />
                  <iframe title="Mobile preview" className="device-screen" src={previewUrl} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
