"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    label: "דשבורד",
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
    label: "כל התנועות",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/business",
    label: "עסקי",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z" strokeLinejoin="round" />
        <path d="M9 21V12h6v9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/budget",
    label: "תקציב",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const BUSINESS_PATHS = ["/business", "/contracts", "/receipts", "/payment-receipts", "/export"];

function SidebarContent({ active, onClose }: { active: string; onClose?: () => void }) {
  return (
    <>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="currentColor">
            <path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2H2V4ZM2 8h16v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Zm4 3a1 1 0 0 0 0 2h4a1 1 0 0 0 0-2H6Z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white leading-tight">Finance</div>
          <div className="text-[0.65rem] text-white/40 leading-tight">ניהול כספים</div>
        </div>
      </div>

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
              <span className={cx("nav-icon", isActive && "nav-icon-active")}>
                {item.icon({ className: "h-4 w-4" })}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 pt-1 space-y-2">
        <div className="rounded-xl bg-[var(--surface)]/5 px-3 py-2.5 text-[0.72rem] leading-relaxed text-white/35">
          תנועות → תקציב → עסקי → ייצוא לרו״ח
        </div>
        <Link href="/passkeys" onClick={onClose} className="block text-center text-[0.7rem] text-white/30 hover:text-white/60">
          ניהול Passkeys
        </Link>
      </div>
    </>
  );
}

export default function AppFrame(props: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  const isChatPage = pathname === "/chat" || pathname.startsWith("/chat/");
  const [open, setOpen] = useState(false);
  const spKey = sp?.toString() ?? "";

  const active = useMemo(() => {
    if (BUSINESS_PATHS.some((p) => pathname.startsWith(p))) return "/business";
    const direct = nav.find((n) => pathname.startsWith(n.href))?.href;
    if (direct) return direct;
    if (pathname.startsWith("/documents")) {
      const from = new URLSearchParams(spKey).get("from");
      if (from === "receipts" || from === "payment-receipts") return "/business";
    }
    return "/dashboard";
  }, [pathname, spKey]);

  if (isAuthPage) return <>{props.children}</>;
  if (isChatPage) return <>{props.children}</>;

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="app-topbar-inner">
          <button
            type="button"
            className="btn btn-ghost btn-topbar md:hidden"
            onClick={() => setOpen(true)}
            aria-label="פתח תפריט"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/dashboard" className="flex min-h-11 min-w-0 items-center gap-2 py-1">
            <span className="brand-badge" aria-hidden />
            <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>Finance</span>
          </Link>

          <div className="flex-1" />
        </div>
      </div>

      <div className="app-main-wrap">
        <aside className="hidden md:block">
          <div className="sidebar">
            <SidebarContent active={active} />
          </div>
        </aside>

        <main className="min-w-0">
          {props.children}
          <footer className="mt-10 pt-4 pb-2 text-center text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
            כלי עזר לניהול בלבד, האחריות על הדיווח לרשויות המס עליך ועל רואה החשבון שלך.
          </footer>
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="סגור תפריט"
            onClick={() => setOpen(false)}
          />
          <div
            className="app-mobile-drawer absolute right-0 top-0 h-full w-[82%] max-w-xs overflow-y-auto shadow-2xl"
            style={{ background: "var(--sidebar-bg)" }}
          >
            <div className="flex items-center justify-end px-3 pt-2">
              <button
                type="button"
                className="btn btn-ghost btn-topbar text-white/60 hover:text-white"
                onClick={() => setOpen(false)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <SidebarContent active={active} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
