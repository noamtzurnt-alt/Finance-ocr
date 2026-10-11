"use client";

import Link from "next/link";
import BrandLogo from "@/app/ui/BrandLogo";

export default function ChatTopBar(props: {
  name?: string;
  logoUrl?: string | null;
}) {
  const name = props.name ?? "Noam Finance";

  return (
    <header className="nf-chat-topbar">
      <div className="nf-chat-topbar-inner">
        <div className="nf-chat-identity">
          <BrandLogo size="md" src={props.logoUrl} className="nf-chat-avatar" />
          <div className="min-w-0">
            <div className="nf-chat-name">{name}</div>
            <div className="nf-chat-status">מחובר · תשובה מיידית</div>
          </div>
        </div>
        <Link href="/dashboard" className="nf-chat-back" prefetch aria-label="חזרה לדשבורד">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
      <div className="nf-chat-topbar-divider" aria-hidden="true" />
    </header>
  );
}
