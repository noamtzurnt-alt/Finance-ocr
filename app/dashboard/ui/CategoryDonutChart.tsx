"use client";

import { useMemo, useState } from "react";
import { categoryColor } from "@/app/lib/ui/category-color";

type Item = { category: string; amount: number };

const SIZE = 160;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function CategoryDonutChart(props: { items: Item[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { slices, total } = useMemo(() => {
    const sorted = [...props.items].sort((a, b) => b.amount - a.amount);
    const total = sorted.reduce((s, x) => s + x.amount, 0);
    let offset = 0;
    const slices = sorted.map((item) => {
      const pct = total > 0 ? item.amount / total : 0;
      const dash = pct * CIRC;
      const slice = { ...item, pct, dash, offset, color: categoryColor(item.category) };
      offset += dash;
      return slice;
    });
    return { slices, total };
  }, [props.items]);

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
        אין הוצאות החודש עדיין
      </div>
    );
  }

  const active = hoverIdx !== null ? slices[hoverIdx] : null;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--surface2)" strokeWidth={STROKE} />
          {slices.map((s, i) => (
            <circle
              key={s.category}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth={hoverIdx === i ? STROKE + 4 : STROKE}
              strokeDasharray={`${s.dash} ${CIRC - s.dash}`}
              strokeDashoffset={-s.offset}
              strokeLinecap={slices.length === 1 ? "butt" : "round"}
              style={{ transition: "stroke-width 160ms ease-out, opacity 160ms ease-out" }}
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.35}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[0.65rem]" style={{ color: "var(--muted)" }}>
            {active ? active.category : "סה״כ"}
          </span>
          <span className="amount text-lg" style={{ color: active ? active.color : "var(--foreground)" }}>
            {Math.round(active ? active.amount : total).toLocaleString()}
          </span>
        </div>
      </div>

      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
        {slices.slice(0, 6).map((s, i) => (
          <li
            key={s.category}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1.5 py-1 transition"
            style={{ background: hoverIdx === i ? "var(--surface2)" : "transparent" }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="cat-dot" style={{ color: s.color, background: s.color }} />
              <span className="truncate" style={{ color: "var(--foreground)" }}>{s.category}</span>
            </span>
            <span className="amount shrink-0 text-xs" style={{ color: "var(--muted)" }}>
              {Math.round(s.pct * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
