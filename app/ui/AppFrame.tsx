"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LogoutButton from "@/app/dashboard/ui/LogoutButton";
import BrandLogo from "@/app/ui/BrandLogo";
import {
  IconClose,
  IconDashboard,
  IconHome,
  IconKey,
  IconList,
  IconMenu,
  IconNotes,
  IconReminders,
  IconSettings,
  IconWallet,
} from "@/app/ui/icons";
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type ShellProfile = {
  displayName: string;
  chatLabel: string;
  showBusiness: boolean;
  logoUrl: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon?: (props: { className?: string }) => React.ReactNode;
  logo?: boolean;
};

const BUSINESS_PATHS = ["/business", "/contracts", "/receipts", "/payment-receipts", "/export"];

function buildNav(profile: ShellProfile | null): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "דשבורד", icon: IconDashboard },
    { href: "/transactions", label: "תנועות", icon: IconList },
  ];
  // Until profile loads keep business visible; Meitar hides it after /api/auth/me.
  if (!profile || profile.showBusiness) {
    items.push({ href: "/business", label: "עסקי", icon: IconHome });
  }
  items.push(
    { href: "/notes", label: "פתקים", icon: IconNotes },
    { href: "/reminders", label: "תזכורות", icon: IconReminders },
    { href: "/vault", label: "סיסמאות", icon: IconKey },
    { href: "/budget", label: "תקציב", icon: IconWallet },
    { href: "/chat", label: profile?.chatLabel ?? "Noam Finance", logo: true },
  );
  return items;
}

const footerNav: NavItem[] = [
  { href: "/passkeys", label: "הגדרות", icon: IconSettings },
];

function SidebarContent({
  active,
  onClose,
  profile,
  nav,
}: {
  active: string;
  onClose?: () => void;
  profile: ShellProfile | null;
  nav: NavItem[];
}) {
  const brand = profile?.displayName ?? "Noam";
  const logoSrc = profile?.logoUrl ?? null;

  return (
    <>
      <Link href="/dashboard" className="sidebar-logo" onClick={onClose}>
        <BrandLogo src={logoSrc} />
        <span className="sidebar-logo-word">{brand}</span>
      </Link>

      <nav className="sidebar-nav" aria-label="תפריט ראשי">
        {nav.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                window.dispatchEvent(new CustomEvent("nf:nav", { detail: item.href }));
                onClose?.();
              }}
              className={cx("nav-link", isActive && "nav-link-active")}
            >
              <span className="nav-icon">
                {item.logo ? (
                  <BrandLogo size="xs" src={logoSrc} />
                ) : (
                  item.icon?.({ className: "h-4.5 w-4.5" })
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {footerNav.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cx("nav-link", isActive && "nav-link-active")}
            >
              <span className="nav-icon">
                {item.icon?.({ className: "h-4.5 w-4.5" })}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <LogoutButton variant="nav" />
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
  const [profile, setProfile] = useState<ShellProfile | null>(null);
  const spKey = sp?.toString() ?? "";
  const nav = useMemo(() => buildNav(profile), [profile]);

  useEffect(() => {
    if (isAuthPage || isChatPage) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ShellProfile | null) => {
        if (!cancelled && data) setProfile(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthPage, isChatPage]);

  useEffect(() => {
    if (!profile || profile.showBusiness) return;
    if (BUSINESS_PATHS.some((p) => pathname.startsWith(p))) {
      window.location.replace("/dashboard");
    }
  }, [pathname, profile]);

  const active = useMemo(() => {
    if (BUSINESS_PATHS.some((p) => pathname.startsWith(p))) return "/business";
    if (pathname.startsWith("/passkeys")) return "/passkeys";
    if (pathname.startsWith("/chat")) return "/chat";
    const direct = nav.find((n) => pathname.startsWith(n.href))?.href;
    if (direct) return direct;
    if (pathname.startsWith("/documents")) {
      const from = new URLSearchParams(spKey).get("from");
      if (from === "receipts" || from === "payment-receipts") return "/business";
    }
    return "/dashboard";
  }, [pathname, spKey, nav]);

  if (isAuthPage) return <>{props.children}</>;
  if (isChatPage) return <>{props.children}</>;

  const brand = profile?.displayName ?? "Noam";
  const logoSrc = profile?.logoUrl ?? null;

  return (
    <div className="app-shell">
      <aside className="sidebar-desktop">
        <div className="sidebar">
          <SidebarContent active={active} profile={profile} nav={nav} />
        </div>
      </aside>

      <div className="app-content">
        <div className="app-mobile-bar">
          <button
            type="button"
            className="btn btn-ghost btn-topbar"
            onClick={() => setOpen(true)}
            aria-label="פתח תפריט"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandLogo size="sm" src={logoSrc} />
            <span className="text-sm font-semibold tracking-tight">{brand}</span>
          </Link>
          <div className="flex-1" />
        </div>

        {props.children}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="app-drawer-overlay absolute inset-0 bg-black/55"
            aria-label="סגור תפריט"
            onClick={() => setOpen(false)}
          />
          <div className="app-mobile-drawer sidebar">
            <div className="flex items-center justify-end px-1 pt-1">
              <button
                type="button"
                className="btn btn-ghost btn-topbar text-white/60 hover:text-white"
                onClick={() => setOpen(false)}
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent active={active} onClose={() => setOpen(false)} profile={profile} nav={nav} />
          </div>
        </div>
      )}
    </div>
  );
}
