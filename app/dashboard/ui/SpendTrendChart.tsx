"use client";

import { useMemo, useState } from "react";

type Point = { day: number; amount: number; cumulative: number };

const WIDTH = 560;
const HEIGHT = 180;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

export default function SpendTrendChart(props: {
  points: Point[];
  daysInMonth: number;
  todayDay: number;
  budgetLimit: number | null;
}) {
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const maxCumulative = useMemo(
    () => Math.max(1, ...props.points.map((p) => p.cumulative), props.budgetLimit ?? 0),
    [props.points, props.budgetLimit],
  );

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xForDay = (day: number) => PAD_LEFT + (innerW * (day - 1)) / Math.max(1, props.daysInMonth - 1);
  const yForVal = (val: number) => PAD_TOP + innerH - (innerH * val) / maxCumulative;

  const linePath = props.points
    .filter((p) => p.day <= props.todayDay)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xForDay(p.day).toFixed(1)} ${yForVal(p.cumulative).toFixed(1)}`)
    .join(" ");

  const areaPath = props.points.length
    ? `${linePath} L ${xForDay(props.todayDay).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} L ${xForDay(1).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} Z`
    : "";

  const hovered = hoverDay != null ? props.points.find((p) => p.day === hoverDay) ?? null : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const dayFloat = 1 + ((relX - PAD_LEFT) / innerW) * (props.daysInMonth - 1);
    const day = Math.min(props.todayDay, Math.max(1, Math.round(dayFloat)));
    setHoverDay(day);
  }

  const paceEnd = props.budgetLimit
    ? `M ${xForDay(1)} ${yForVal(0)} L ${xForDay(props.daysInMonth)} ${yForVal(props.budgetLimit)}`
    : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverDay(null)}
        className="cursor-crosshair"
      >
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spendLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-2)" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={PAD_TOP + innerH * f}
            y2={PAD_TOP + innerH * f}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}

        {/* budget pace reference line */}
        {paceEnd && (
          <path d={paceEnd} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" opacity={0.6} />
        )}

        {areaPath && <path d={areaPath} fill="url(#spendFill)" />}
        {linePath && <path d={linePath} stroke="url(#spendLine)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}

        {hovered && (
          <g>
            <line
              x1={xForDay(hovered.day)}
              x2={xForDay(hovered.day)}
              y1={PAD_TOP}
              y2={PAD_TOP + innerH}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={xForDay(hovered.day)} cy={yForVal(hovered.cumulative)} r={4} fill="var(--brand-2)" stroke="var(--bg)" strokeWidth={2} />
          </g>
        )}

        {/* x-axis day labels: start, mid, today */}
        <text x={PAD_LEFT} y={HEIGHT - 6} fontSize="10" fill="var(--muted)">1</text>
        <text x={xForDay(props.todayDay)} y={HEIGHT - 6} fontSize="10" fill="var(--muted)" textAnchor="middle">
          היום
        </text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 6} fontSize="10" fill="var(--muted)" textAnchor="end">
          {props.daysInMonth}
        </text>
      </svg>

      <div className="mt-1 flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
        <span>
          {hovered ? `יום ${hovered.day}` : `יום ${props.todayDay}`} ·{" "}
          <span className="amount" style={{ color: "var(--foreground)" }}>
            {Math.round(hovered ? hovered.cumulative : props.points.find((p) => p.day === props.todayDay)?.cumulative ?? 0).toLocaleString()} ₪
          </span>
        </span>
        {props.budgetLimit ? <span>קו מקווקו · קצב תקציב</span> : null}
      </div>
    </div>
  );
}
