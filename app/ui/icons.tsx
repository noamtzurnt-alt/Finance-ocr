/** One stroke language for the Yanz shell — 1.65, round caps, no fills except dots. */

const sw = 1.65;

function Svg(props: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.children}
    </svg>
  );
}

export function IconDashboard({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3.2" y="3.2" width="7.4" height="7.4" rx="1.5" />
      <rect x="13.4" y="3.2" width="7.4" height="7.4" rx="1.5" />
      <rect x="3.2" y="13.4" width="7.4" height="7.4" rx="1.5" />
      <rect x="13.4" y="13.4" width="7.4" height="7.4" rx="1.5" />
    </Svg>
  );
}

export function IconList({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M8 6.5h12M8 12h12M8 17.5h12" />
      <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" />
    </Svg>
  );
}

export function IconHome({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-9.5Z" />
    </Svg>
  );
}

export function IconWallet({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3" y="7" width="18" height="12.2" rx="2.2" />
      <path d="M3 10.2h18" />
      <circle cx="16.4" cy="14.4" r="1.05" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconNotes({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M7 3.8h8.2A2.2 2.2 0 0 1 17.4 6v12.4L14.2 20.2H7A2.2 2.2 0 0 1 4.8 18V6A2.2 2.2 0 0 1 7 3.8Z" />
      <path d="M14.2 20.2v-3.2h3.2" />
      <path d="M8 8.4h6.2M8 12h6.2M8 15.4h3.6" />
    </Svg>
  );
}

export function IconReminders({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="5.6" cy="6.5" r="1.6" />
      <circle cx="5.6" cy="12" r="1.6" />
      <circle cx="5.6" cy="17.5" r="1.6" />
      <path d="M10 6.5h10M10 12h10M10 17.5h6" />
    </Svg>
  );
}

export function IconCalendar({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="15.2" rx="2" />
      <path d="M3.5 9.2h17M8 3.5v3.2M16 3.5v3.2" />
    </Svg>
  );
}

export function IconCard({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="2.8" y="5.5" width="18.4" height="13" rx="2" />
      <path d="M2.8 9.6h18.4M6.2 14.2h4.2" />
    </Svg>
  );
}

export function IconGrid({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.4" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
    </Svg>
  );
}

export function IconSettings({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3.4v1.8M12 18.8v1.8M3.4 12h1.8M18.8 12h1.8M5.7 5.7l1.3 1.3M17 17l1.3 1.3M5.7 18.3 7 17M17 7l1.3-1.3" />
    </Svg>
  );
}

export function IconSupport({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M5 18.5v-2.2A7 7 0 0 1 12 4.5a7 7 0 0 1 7 11.8v2.2" />
      <path d="M9 18.5h6" />
    </Svg>
  );
}

export function IconLogout({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M10 7.2V5.4A1.8 1.8 0 0 1 11.8 3.6H19.5v16.8h-7.7A1.8 1.8 0 0 1 10 18.6v-1.8" />
      <path d="M4 12h10.5M7.5 8.4 4 12l3.5 3.6" />
    </Svg>
  );
}

export function IconBars({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M5 19V9.5M12 19V5M19 19v-6.5" />
    </Svg>
  );
}

export function IconBank({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 10.2h16M6.2 10.2V18M10.1 10.2V18M13.9 10.2V18M17.8 10.2V18M3.4 18h17.2M12 4.2 20.6 10H3.4L12 4.2Z" />
    </Svg>
  );
}

export function IconMenu({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function IconClose({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconKebab({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <circle cx="8" cy="3.2" r="1.15" />
      <circle cx="8" cy="8" r="1.15" />
      <circle cx="8" cy="12.8" r="1.15" />
    </svg>
  );
}

export function IconPencil({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M15.6 4.6a2.1 2.1 0 0 1 3 3L8.4 17.8 4 19l1.2-4.4L15.6 4.6Z" />
      <path d="M13.8 6.4l3 3" />
    </Svg>
  );
}

export function IconInfo({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5.2" />
      <path d="M12 7.8h.01" />
    </Svg>
  );
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.5 7l.8 11.4A1.7 1.7 0 0 0 9 20h6a1.7 1.7 0 0 0 1.7-1.6L17.5 7" />
    </Svg>
  );
}

export function IconFolder({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M3.5 7.2A1.7 1.7 0 0 1 5.2 5.5h4l2 2.2h7.6a1.7 1.7 0 0 1 1.7 1.7v8.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z" />
    </Svg>
  );
}

export function IconFolderPlus({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M3.5 7.2A1.7 1.7 0 0 1 5.2 5.5h4l2 2.2h7.6a1.7 1.7 0 0 1 1.7 1.7v8.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z" />
      <path d="M12 10.5v5M9.5 13h5" />
    </Svg>
  );
}

export function IconCheck({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M5 12.5 9.8 17 19 7.5" />
    </Svg>
  );
}

/** Points left; in RTL that reads as "forward". */
export function IconChevronLeft({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M14.5 6 8.5 12l6 6" />
    </Svg>
  );
}

export function IconChevronRight({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M9.5 6l6 6-6 6" />
    </Svg>
  );
}

export function IconBriefcase({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3.2" y="7.2" width="17.6" height="12" rx="2" />
      <path d="M8.8 7.2V5.6A1.6 1.6 0 0 1 10.4 4h3.2a1.6 1.6 0 0 1 1.6 1.6v1.6M3.2 12.4h17.6" />
    </Svg>
  );
}

export function IconSavings({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 3.6v2.2M12 18.2v2.2" />
      <path d="M15.6 7.6c-.6-1-1.9-1.6-3.6-1.6-2 0-3.4 1-3.4 2.6 0 3.6 7.2 1.8 7.2 5.6 0 1.6-1.5 2.8-3.8 2.8-1.8 0-3.2-.7-3.8-1.9" />
    </Svg>
  );
}

export function IconPlusCircle({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 8.4v7.2M8.4 12h7.2" />
    </Svg>
  );
}

export function IconRefresh({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.2" />
      <path d="M19.6 4.6v3.8h-3.8" />
    </Svg>
  );
}

export function IconPercent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="7.2" cy="7.2" r="2.1" />
      <circle cx="16.8" cy="16.8" r="2.1" />
      <path d="M17.4 6.2 6.6 17.8" />
    </svg>
  );
}

export function IconKey({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="8" cy="15.5" r="4.2" />
      <path d="m11 12.5 8.6-8.6M16.8 6.7l2.4 2.4M14.6 8.9l1.9 1.9" />
    </Svg>
  );
}

export function IconLock({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <path d="M12 14.6v2.2" />
    </Svg>
  );
}

export function IconEye({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M2.8 12s3.4-6.3 9.2-6.3 9.2 6.3 9.2 6.3-3.4 6.3-9.2 6.3S2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  );
}

export function IconEyeOff({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.7c5.8 0 9.2 6.3 9.2 6.3a16 16 0 0 1-2.6 3.4M6.3 7.4A15.6 15.6 0 0 0 2.8 12s3.4 6.3 9.2 6.3a9 9 0 0 0 4.4-1.1" />
      <path d="M9.9 10a2.8 2.8 0 0 0 4 4" />
      <path d="m3.5 3.5 17 17" />
    </Svg>
  );
}

export function IconCopy({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2" />
      <path d="M15.5 8.5V6.2A2.2 2.2 0 0 0 13.3 4H6.2A2.2 2.2 0 0 0 4 6.2v7.1a2.2 2.2 0 0 0 2.2 2.2h2.3" />
    </Svg>
  );
}

export function IconSearch({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4.7 4.7" />
    </Svg>
  );
}

export function IconFaceId({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M7 3.5H5.5a2 2 0 0 0-2 2V7M17 3.5h1.5a2 2 0 0 1 2 2V7M7 20.5H5.5a2 2 0 0 1-2-2V17M17 20.5h1.5a2 2 0 0 0 2-2V17" />
      <path d="M8.8 9.2v1.3M15.2 9.2v1.3M12 9.2v3.6h-.9" />
      <path d="M9 15.6a4.3 4.3 0 0 0 6 0" />
    </Svg>
  );
}

export function IconStar({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />
    </svg>
  );
}
