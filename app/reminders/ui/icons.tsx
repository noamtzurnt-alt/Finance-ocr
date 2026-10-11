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
      aria-hidden
    >
      {props.children}
    </svg>
  );
}

type P = { className?: string };

export const LIST_ICONS: Record<string, (p: P) => React.ReactNode> = {
  list: (p) => (
    <Svg {...p}>
      <path d="M9 6.5h10M9 12h10M9 17.5h10" />
      <circle cx="5" cy="6.5" r="0.9" fill="currentColor" />
      <circle cx="5" cy="12" r="0.9" fill="currentColor" />
      <circle cx="5" cy="17.5" r="0.9" fill="currentColor" />
    </Svg>
  ),
  home: (p) => (
    <Svg {...p}>
      <path d="M4 11.2 12 4.5l8 6.7V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" />
    </Svg>
  ),
  work: (p) => (
    <Svg {...p}>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
    </Svg>
  ),
  cart: (p) => (
    <Svg {...p}>
      <path d="M3.5 4.5h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.7a1.5 1.5 0 0 0 1.5-1.1l1.6-6.3H6.4" />
      <circle cx="9.5" cy="19.5" r="1.2" />
      <circle cx="17" cy="19.5" r="1.2" />
    </Svg>
  ),
  heart: (p) => (
    <Svg {...p}>
      <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />
    </Svg>
  ),
  star: (p) => (
    <Svg {...p}>
      <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 15.9l-4.9 2.7 1.1-5.3-4-3.7 5.4-.6Z" />
    </Svg>
  ),
  book: (p) => (
    <Svg {...p}>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5Zm0 14A1.5 1.5 0 0 0 6.5 21H19" />
    </Svg>
  ),
  plane: (p) => (
    <Svg {...p}>
      <path d="M10.5 13.5 4 11l1.3-1.3 7.2.8 4.3-4.3a1.8 1.8 0 0 1 2.5 2.5l-4.3 4.3.8 7.2L14.5 21 12 14.5l-3 3v2.3L7.8 21l-1.2-3.4L3 16.3 4.3 15h2.2Z" />
    </Svg>
  ),
  gift: (p) => (
    <Svg {...p}>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M3.5 9h17M12 9v11M12 9S10.8 4.5 8.5 4.5a2 2 0 0 0 0 4.5M12 9s1.2-4.5 3.5-4.5a2 2 0 0 1 0 4.5" />
    </Svg>
  ),
  sport: (p) => (
    <Svg {...p}>
      <path d="M6 8v8M18 8v8M3.5 10v4M20.5 10v4M6 12h12" />
    </Svg>
  ),
  food: (p) => (
    <Svg {...p}>
      <path d="M7 3.5v7a2 2 0 0 0 2 2v8M5 3.5v5M9 3.5v5M16.5 20.5v-17c-2 0-3.5 2.5-3.5 6.5 0 2.2 1.5 3 3.5 3" />
    </Svg>
  ),
  money: (p) => (
    <Svg {...p}>
      <rect x="3" y="6.5" width="18" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9.5v.01M17.5 14.5v.01" />
    </Svg>
  ),
  car: (p) => (
    <Svg {...p}>
      <path d="M4.5 16.5V12l1.8-4.6A1.5 1.5 0 0 1 7.7 6.5h8.6a1.5 1.5 0 0 1 1.4.9l1.8 4.6v4.5M4.5 12h15" />
      <path d="M4.5 16.5h15v1.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1.5M8 16.5V18a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-1.5" />
      <path d="M7.5 14h.01M16.5 14h.01" />
    </Svg>
  ),
  health: (p) => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Svg>
  ),
  music: (p) => (
    <Svg {...p}>
      <path d="M9 17.5V6l10-2v11.5" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.5" r="2.5" />
    </Svg>
  ),
  paw: (p) => (
    <Svg {...p}>
      <path d="M12 12.5c-2.6 0-5 2.6-5 5 0 1.4 1.1 2 2.4 2 1 0 1.7-.5 2.6-.5s1.6.5 2.6.5c1.3 0 2.4-.6 2.4-2 0-2.4-2.4-5-5-5Z" />
      <circle cx="6" cy="10" r="1.6" />
      <circle cx="9.5" cy="6" r="1.6" />
      <circle cx="14.5" cy="6" r="1.6" />
      <circle cx="18" cy="10" r="1.6" />
    </Svg>
  ),
  school: (p) => (
    <Svg {...p}>
      <path d="m3 9 9-4.5L21 9l-9 4.5Z" />
      <path d="M7 11v4.5c0 1.4 2.2 3 5 3s5-1.6 5-3V11M21 9v5" />
    </Svg>
  ),
  bulb: (p) => (
    <Svg {...p}>
      <path d="M9 17.5h6M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.8.6 1.3 1.5 1.3 2.5v1.6h4v-1.6c0-1 .5-1.9 1.3-2.5A5.5 5.5 0 0 0 12 3.5Z" />
    </Svg>
  ),
};

export const LIST_ICON_KEYS = Object.keys(LIST_ICONS);

export function ListGlyph(props: { icon: string; className?: string }) {
  const Icon = LIST_ICONS[props.icon] ?? LIST_ICONS.list;
  return <Icon className={props.className} />;
}

export function IconCalendarDay(props: P & { day: number }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth={sw} />
      <path d="M3.5 9h17" stroke="currentColor" strokeWidth={sw} />
      <text x="12" y="17.6" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">
        {props.day}
      </text>
    </svg>
  );
}

export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
    <path d="M3.5 9.5h17M8 3v3M16 3v3" />
  </Svg>
);
export const IconTray = (p: P) => (
  <Svg {...p}>
    <path d="M4 13.5 6.3 5.8A1.5 1.5 0 0 1 7.7 4.8h8.6a1.5 1.5 0 0 1 1.4 1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z" />
    <path d="M4 13.5h4.5l1 2h5l1-2H20" />
  </Svg>
);
export const IconFlag = (p: P & { filled?: boolean }) => (
  <Svg className={p.className}>
    <path d="M5.5 21V4.5M5.5 4.5h11l-2 4 2 4h-11" fill={p.filled ? "currentColor" : "none"} />
  </Svg>
);
export const IconCheckCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.2 2.5 2.5 5-5.2" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconRepeat = (p: P) => (
  <Svg {...p}>
    <path d="M17 3.5 20 6.5l-3 3M20 6.5H8a4 4 0 0 0-4 4v1M7 20.5l-3-3 3-3M4 17.5h12a4 4 0 0 0 4-4v-1" />
  </Svg>
);
export const IconTag = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0Z" />
    <circle cx="8" cy="8" r="1.3" />
  </Svg>
);
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconIndent = (p: P) => (
  <Svg {...p}>
    <path d="M20 6H4M20 18H4M20 12h-9M4.5 9.5 7 12l-2.5 2.5" />
  </Svg>
);
export const IconOutdent = (p: P) => (
  <Svg {...p}>
    <path d="M20 6H4M20 18H4M20 12h-9M7 9.5 4.5 12 7 14.5" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.01" />
  </Svg>
);
export const IconMore = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth={2.4} />
  </Svg>
);
export const IconColumns = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="5" height="15" rx="1.5" />
    <rect x="9.5" y="4.5" width="5" height="10" rx="1.5" />
    <rect x="15.5" y="4.5" width="5" height="12.5" rx="1.5" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);
export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M7.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
  </Svg>
);
export const IconArrowMove = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h15M14 7l5 5-5 5" />
  </Svg>
);
