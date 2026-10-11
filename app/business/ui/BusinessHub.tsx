"use client";

import Link from "next/link";

type HubItem = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const items: HubItem[] = [
  {
    href: "/contracts",
    title: "חוזים",
    description: "חוזי לקוחות, PDF חתום ועותקי מייל",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 3h7l3 3v15a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v4h4M8 11h6M8 15h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/receipts",
    title: "הוצאות מוכרות",
    description: "קבלות והוצאות לדיווח, לפי תיקיות וחודשים",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/payment-receipts",
    title: "קבלות הכנסות",
    description: "מסמכי הכנסה, חשבוניות וקבלות מלקוחות",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: "/export",
    title: "ייצוא",
    description: "ייצוא שנתי לרו״ח – Excel ו-ZIP",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v12M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 21h16" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BusinessHub() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="business-hub-card group"
        >
          <div className="business-hub-icon">
            {item.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[var(--foreground)]">{item.title}</h2>
              <span className="business-hub-arrow" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{item.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
