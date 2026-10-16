"use client";

import { useMemo, useState } from "react";
import { categoryColor, categoryColorSoft, categoryColorBorder } from "@/app/lib/ui/category-color";
import AppModal from "@/app/ui/AppModal";

type Item = { category: string; amount: number };

type CategoryTx = {
  id: string;
  date: string;
  vendor: string;
  description: string | null;
  amount: number;
  cardLast4: string | null;
};

const SIZE = 148;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

function fmt(n: number) {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

export default function CategoryDonutChart(props: {
  items: Item[];
  categoryBudgets?: Record<string, number>;
  /** YYYY-MM of the dashboard month. Category drill-down uses the same window. */
  month?: string;
  /** Days elapsed in the cycle, or the full length of a closed month. */
  dayCount?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [popupItems, setPopupItems] = useState<CategoryTx[] | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);

  const { slices, total, categoryCount, topThree } = useMemo(() => {
    const sorted = [...props.items].sort((a, b) => b.amount - a.amount);
    const total = sorted.reduce((s, x) => s + x.amount, 0);
    let offset = 0;
    const slices = sorted.map((item) => {
      const pct = total > 0 ? item.amount / total : 0;
      const dash = pct * CIRC;
      const budget = props.categoryBudgets?.[item.category] ?? 0;
      const budgetPct = budget > 0 ? Math.min(100, Math.round((item.amount / budget) * 100)) : null;
      const overBudget = budget > 0 && item.amount > budget;
      const slice = {
        ...item,
        pct,
        dash,
        offset,
        budget,
        budgetPct,
        overBudget,
        color: categoryColor(item.category),
      };
      offset += dash;
      return slice;
    });
    return { slices, total, categoryCount: sorted.length, topThree: slices.slice(0, 3) };
  }, [props.items, props.categoryBudgets]);

  const dailyAvg = useMemo(() => {
    if (total <= 0) return 0;
    return Math.round(total / Math.max(props.dayCount || new Date().getDate(), 1));
  }, [total, props.dayCount]);

  async function openCategory(category: string) {
    setSelectedCategory(category);
    setPopupItems(null);
    setPopupError(null);
    setPopupLoading(true);
    try {
      const params = new URLSearchParams({ category });
      if (props.month) params.set("month", props.month);
      const res = await fetch(`/api/dashboard/category-transactions?${params}`);
      const data = (await res.json().catch(() => null)) as
        | { items?: CategoryTx[]; error?: string }
        | null;
      if (!res.ok || !data?.items) {
        setPopupError(data?.error || "לא הצלחתי לטעון את ההוצאות");
        return;
      }
      setPopupItems(data.items);
    } catch {
      setPopupError("אין חיבור לרשת");
    } finally {
      setPopupLoading(false);
    }
  }

  function closePopup() {
    setSelectedCategory(null);
    setPopupItems(null);
    setPopupError(null);
  }

  if (total === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-icon chart-empty-icon--accent" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" strokeLinecap="round" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="chart-empty-title">אין הוצאות בחודש הזה</p>
        <p className="chart-empty-sub">ברגע שתוסיף תנועות, תראה כאן פילוח לפי קטגוריה ותובנות</p>
      </div>
    );
  }

  const active = hoverIdx !== null ? slices[hoverIdx] : null;
  const overBudgetCount = slices.filter((s) => s.overBudget).length;
  const popupTotal = (popupItems ?? []).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="category-chart-v2">
      <div className="cat-stat-chips">
        {topThree.map((s) => (
          <button
            key={s.category}
            type="button"
            className="cat-stat-chip"
            style={{
              background: categoryColorSoft(s.category),
              borderColor: categoryColorBorder(s.category),
              color: s.color,
            }}
            onMouseEnter={() => setHoverIdx(slices.indexOf(s))}
            onMouseLeave={() => setHoverIdx(null)}
            onClick={() => void openCategory(s.category)}
          >
            <span className="cat-stat-chip-name">{s.category}</span>
            <strong className="cat-stat-chip-val amount">{Math.round(s.pct * 100)}%</strong>
          </button>
        ))}
      </div>

      <div className="category-chart-donut-wrap">
        <div className="category-chart-donut" style={{ width: SIZE, height: SIZE }}>
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
                strokeWidth={hoverIdx === i ? STROKE + 3 : STROKE}
                strokeDasharray={`${s.dash} ${CIRC - s.dash}`}
                strokeDashoffset={-s.offset}
                strokeLinecap="butt"
                style={{ transition: "stroke-width 160ms ease-out, opacity 160ms ease-out", cursor: "pointer" }}
                opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.3}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => void openCategory(s.category)}
                className="donut-draw"
              />
            ))}
          </svg>
          <div className="category-chart-center">
            <span className="category-chart-center-label">
              {active ? active.category : "סה״כ הוצאות"}
            </span>
            <span className="category-chart-center-value amount" style={{ color: active ? active.color : "var(--brand)" }}>
              {fmt(active ? active.amount : total)} ₪
            </span>
            {!active ? (
              <span className="category-chart-center-meta">
                {categoryCount} קטגוריות · ~{fmt(dailyAvg)} ₪/יום
              </span>
            ) : (
              <span className="category-chart-center-meta">{Math.round(active.pct * 100)}% מהחודש</span>
            )}
          </div>
        </div>
      </div>

      {overBudgetCount > 0 ? (
        <div className="cat-alert">
          <span className="cat-alert-dot" />
          {overBudgetCount} {overBudgetCount === 1 ? "קטגוריה חורגת" : "קטגוריות חורגות"} מהתקציב
        </div>
      ) : null}

      <ul className="category-breakdown-v2">
        {slices.slice(0, 6).map((s, i) => (
          <li key={s.category}>
            <button
              type="button"
              className={`category-breakdown-v2-row${hoverIdx === i ? " is-active" : ""}${s.overBudget ? " is-over" : ""}`}
              style={{
                background: categoryColorSoft(s.category),
                borderColor: categoryColorBorder(s.category),
                ["--row-accent" as string]: s.color,
                width: "100%",
                textAlign: "inherit",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={() => void openCategory(s.category)}
            >
              <div className="category-breakdown-v2-head">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="cat-dot-lg" style={{ background: s.color }} />
                  <span className="truncate font-semibold" style={{ color: "var(--foreground)" }}>{s.category}</span>
                </span>
                <span className="category-breakdown-stats amount shrink-0">
                  <span style={{ color: "var(--foreground)" }}>{fmt(s.amount)} ₪</span>
                  <span className="cat-pct-pill" style={{ background: s.color }}>{Math.round(s.pct * 100)}%</span>
                </span>
              </div>
              <div className="category-breakdown-track">
                <div className="category-breakdown-fill goal-fill" style={{ width: `${Math.max(s.pct * 100, 3)}%`, background: s.color }} />
              </div>
              {s.budget > 0 ? (
                <div className="cat-budget-row">
                  <span className={s.overBudget ? "text-negative" : ""}>
                    תקציב: {fmt(s.amount)} / {fmt(s.budget)} ₪
                  </span>
                  <span className={s.overBudget ? "text-negative font-semibold" : ""}>{s.budgetPct}%</span>
                </div>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {selectedCategory ? (
        <AppModal
          open
          onClose={closePopup}
          label={`הוצאות ב${selectedCategory}`}
          wide
          className="nf-modal--sheet"
        >
          <div className="nf-modal-head">
            <div>
              <h3 className="nf-modal-title">{selectedCategory}</h3>
              <p className="nf-modal-sub">
                {popupLoading
                  ? "טוען…"
                  : popupItems
                    ? `${popupItems.length} תנועות · ${fmt(popupTotal)} ₪`
                    : "הוצאות החודש"}
              </p>
            </div>
            <button type="button" className="tx-detail-close" onClick={closePopup} aria-label="סגור">
              ✕
            </button>
          </div>
          {popupError ? <div className="tx-alert tx-alert--error">{popupError}</div> : null}
          {!popupLoading && popupItems && popupItems.length === 0 ? (
            <p className="nf-modal-empty">אין תנועות בקטגוריה הזו החודש.</p>
          ) : null}
          <ul className="nf-modal-list">
            {(popupItems ?? []).map((t) => (
              <li key={t.id} className="nf-modal-list-item">
                <div className="min-w-0">
                  <div className="nf-modal-list-title">{t.vendor}</div>
                  <div className="nf-modal-list-meta">
                    {fmtDate(t.date)}
                    {t.description ? ` · ${t.description}` : ""}
                    {t.cardLast4 ? ` · ${t.cardLast4}` : ""}
                  </div>
                </div>
                <strong className="amount shrink-0">{fmt(t.amount)} ₪</strong>
              </li>
            ))}
          </ul>
        </AppModal>
      ) : null}
    </div>
  );
}
