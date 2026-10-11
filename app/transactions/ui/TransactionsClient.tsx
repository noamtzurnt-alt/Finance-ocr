"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categoryColor } from "@/app/lib/ui/category-color";
import {
  CHAT_PAYMENT_OPTIONS,
  formatPaymentMethodLabel,
} from "@/app/lib/transactions/chat-payment";
import AppModal from "@/app/ui/AppModal";
import { todayLocalIso } from "@/app/lib/ui/local-date";
import ImportStatementCard from "./ImportStatementCard";

const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יונ׳", "יול׳", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

function dateParts(iso: string) {
  const d = new Date(iso);
  return { day: String(d.getDate()), month: MONTHS[d.getMonth()] ?? "" };
}

function fmtAmount(raw: string | number) {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function monthLabelFromKey(key: string) {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const dt = new Date(y, Math.max(0, m - 1), 1);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(dt);
}

/** YYYY-MM of the budget month a YYYY-MM-DD date belongs to. */
function cycleMonthKey(isoDate: string, startDay: number) {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  const d = Number(isoDate.slice(8, 10));
  if (d >= startDay) return isoDate.slice(0, 7);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

type BudgetScope = "personal" | "business";

type Category = { id: string; name: string; budgetScope: BudgetScope };
type Row = {
  id: string;
  date: string;
  amount: string;
  currency: string;
  vendor: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryScope: BudgetScope | null;
  cardLast4: string | null;
  updatedAt: string;
};

type EditState = {
  id: string;
  date: string;
  amount: string;
  vendor: string;
  description: string;
  categoryId: string;
  cardLast4: string;
  scope: BudgetScope;
};

const SCOPE_META: Record<BudgetScope, { title: string; short: string }> = {
  personal: { title: "חיים אישיים", short: "אישי" },
  business: { title: "עסק", short: "עסקי" },
};

function sumAmount(rows: Row[]) {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

function normalizeVendorKey(name: string) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/שקלים?|₪|nis|ils|usd|\$|eur|€/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/(ות|ים|ין|ה)$/u, "")
    .trim();
}

function findDuplicateGroups(rows: Row[]) {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    const key = `${normalizeVendorKey(row.vendor)}|${amount.toFixed(2)}`;
    if (!key.startsWith("|")) {
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
  }
  return [...map.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, group }));
}

export default function TransactionsClient(props: {
  categories: Category[];
  initialItems: Row[];
  initialYear: number;
  initialMonth: number;
  cycleStartDay?: number;
}) {
  const cycleStartDay = props.cycleStartDay ?? 1;
  const [items, setItems] = useState<Row[]>(props.initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const editRef = useRef<HTMLDivElement | null>(null);

  const personalCategories = useMemo(
    () => props.categories.filter((c) => c.budgetScope === "personal"),
    [props.categories],
  );
  const businessCategories = useMemo(
    () => props.categories.filter((c) => c.budgetScope === "business"),
    [props.categories],
  );

  const categoriesByScope = useMemo(
    () => ({ personal: personalCategories, business: businessCategories }),
    [personalCategories, businessCategories],
  );

  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState(() => todayLocalIso());
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentOptionId, setPaymentOptionId] = useState("7374");
  const [paymentOther, setPaymentOther] = useState("");
  const [cardLast4, setCardLast4] = useState("7374");

  useEffect(() => {
    if (props.categories.length === 0) {
      setCategoryId("");
      return;
    }
    if (!props.categories.some((c) => c.id === categoryId)) {
      setCategoryId(props.categories[0]!.id);
    }
  }, [props.categories, categoryId]);

  useEffect(() => {
    const known = CHAT_PAYMENT_OPTIONS.find((o) => o.id === paymentOptionId);
    if (!known || known.id === "other") return;
    setCardLast4(known.value);
  }, [paymentOptionId]);

  const [filterYear, setFilterYear] = useState(String(props.initialYear));
  const [filterMonth, setFilterMonth] = useState(String(props.initialMonth));
  const [query, setQuery] = useState("");
  const [filterPayment, setFilterPayment] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [dupesOpen, setDupesOpen] = useState(false);

  useEffect(() => {
    if (filterYear === String(props.initialYear) && filterMonth === String(props.initialMonth)) {
      setItems(props.initialItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialItems]);

  const paymentFilterOptions = useMemo(() => {
    const known = new Map<string, string>();
    for (const opt of CHAT_PAYMENT_OPTIONS) {
      if (opt.id === "other") continue;
      known.set(opt.value, opt.label);
    }
    for (const row of items) {
      const key = (row.cardLast4 ?? "").trim();
      if (!key || known.has(key)) continue;
      known.set(key, formatPaymentMethodLabel(key));
    }
    return [...known.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "he"));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((x) => {
      if (filterPayment !== "all") {
        const pay = (x.cardLast4 ?? "").trim();
        if (filterPayment === "__none__") {
          if (pay) return false;
        } else if (pay !== filterPayment) {
          return false;
        }
      }
      if (!q) return true;
      return (x.vendor + " " + (x.description ?? "") + " " + (x.cardLast4 ?? "")).toLowerCase().includes(q);
    });
  }, [items, query, filterPayment]);

  const personalRows = useMemo(
    () => filtered.filter((t) => t.categoryScope !== "business"),
    [filtered],
  );
  const businessRows = useMemo(
    () => filtered.filter((t) => t.categoryScope === "business"),
    [filtered],
  );

  const displayRows = filtered;

  const selectedMonthLabel = useMemo(() => {
    const mm = String(filterMonth).padStart(2, "0");
    const base = monthLabelFromKey(`${filterYear}-${mm}`);
    if (cycleStartDay === 1) return base;
    const m = Number(filterMonth);
    const last = new Date(Number(filterYear), m, cycleStartDay - 1);
    return `${base} (${cycleStartDay}.${m}–${last.getDate()}.${last.getMonth() + 1})`;
  }, [filterYear, filterMonth, cycleStartDay]);

  const totalAmount = sumAmount(filtered);
  const personalTotal = sumAmount(personalRows);
  const businessTotal = sumAmount(businessRows);

  const monthGroups = useMemo(() => {
    const groups: { month: string; items: Row[] }[] = [];
    let currentMonth = "";
    for (const row of displayRows) {
      const m = cycleMonthKey(row.date, cycleStartDay);
      if (m !== currentMonth) {
        currentMonth = m;
        groups.push({ month: m, items: [] });
      }
      groups[groups.length - 1]!.items.push(row);
    }
    return groups;
  }, [displayRows, cycleStartDay]);

  const duplicateGroups = useMemo(() => findDuplicateGroups(displayRows), [displayRows]);

  async function reload() {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ limit: "200", year: filterYear, month: filterMonth });
    const res = await fetch(`/api/transactions?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setError("לא הצלחתי לטעון");
      return;
    }
    setItems((await res.json()) as Row[]);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setError("בחר קטגוריה");
      return;
    }
    const paymentValue =
      paymentOptionId === "other"
        ? paymentOther.trim()
        : (CHAT_PAYMENT_OPTIONS.find((o) => o.id === paymentOptionId)?.value ?? cardLast4);
    if (!paymentValue) {
      setError("בחר אמצעי תשלום");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date,
        amount,
        vendor,
        description: description || null,
        categoryId,
        currency: "ILS",
        cardLast4: paymentValue,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאה");
      return;
    }
    setAmount("");
    setVendor("");
    setDescription("");
    setPaymentOther("");
    setAddOpen(false);
    await reload();
  }

  async function remove(id: string) {
    if (!confirm("למחוק תנועה?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  }

  function startEdit(t: Row) {
    const rowScope: BudgetScope = t.categoryScope === "business" ? "business" : "personal";
    setEditState({
      id: t.id,
      date: t.date,
      amount: t.amount,
      vendor: t.vendor,
      description: t.description ?? "",
      categoryId: t.categoryId ?? "",
      cardLast4: t.cardLast4 ?? "",
      scope: rowScope,
    });
    setTimeout(() => editRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  function cancelEdit() {
    setEditState(null);
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/transactions/${editState.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: editState.date,
        amount: editState.amount,
        vendor: editState.vendor,
        description: editState.description || null,
        categoryId: editState.categoryId || null,
        cardLast4: editState.cardLast4 || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאת שמירה");
      return;
    }
    const updatedCategory = props.categories.find((c) => c.id === editState.categoryId) ?? null;
    setItems((prev) =>
      prev.map((x) =>
        x.id === editState.id
          ? {
              ...x,
              date: editState.date,
              amount: editState.amount,
              vendor: editState.vendor,
              description: editState.description || null,
              categoryId: editState.categoryId || null,
              categoryName: updatedCategory?.name ?? null,
              categoryScope: updatedCategory?.budgetScope ?? null,
              cardLast4: editState.cardLast4 || null,
            }
          : x,
      ),
    );
    setEditState(null);
  }

  function renderEditForm(t: Row) {
    if (!editState || editState.id !== t.id) return null;
    const editCats = categoriesByScope[editState.scope];
    return (
      <div ref={editRef} className="tx-edit-panel">
        <p className="tx-edit-panel-title">עריכת תנועה</p>
        <div className="tx-edit-grid">
          <div>
            <label className="field-label">תאריך</label>
            <input className="field mt-1" type="date" value={editState.date}
              onChange={(e) => setEditState({ ...editState, date: e.target.value })} />
          </div>
          <div>
            <label className="field-label">סכום</label>
            <input className="field mt-1" value={editState.amount}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if ((v.match(/\./g) ?? []).length <= 1) setEditState({ ...editState, amount: v }); }}
              inputMode="decimal" placeholder="סכום" />
          </div>
          <div className="tx-edit-span-2">
            <label className="field-label">בית עסק</label>
            <input className="field mt-1" value={editState.vendor}
              onChange={(e) => setEditState({ ...editState, vendor: e.target.value })} placeholder="בית עסק" />
          </div>
          <div>
            <label className="field-label">סוג</label>
            <select className="field mt-1" value={editState.scope}
              onChange={(e) => {
                const nextScope = e.target.value as BudgetScope;
                const first = categoriesByScope[nextScope][0]?.id ?? "";
                setEditState({ ...editState, scope: nextScope, categoryId: first });
              }}>
              <option value="personal">אישי</option>
              <option value="business">עסק</option>
            </select>
          </div>
          <div>
            <label className="field-label">קטגוריה</label>
            <select className="field mt-1" value={editState.categoryId}
              onChange={(e) => setEditState({ ...editState, categoryId: e.target.value })}>
              <option value="">בחר קטגוריה</option>
              {editCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="tx-edit-span-2">
            <label className="field-label">תיאור</label>
            <input className="field mt-1" value={editState.description}
              onChange={(e) => setEditState({ ...editState, description: e.target.value })} placeholder="תיאור" />
          </div>
        </div>
        <div className="tx-edit-actions">
          <button className="btn btn-primary text-xs" type="button" onClick={() => void saveEdit()} disabled={saving}>
            {saving ? "…" : "שמור"}
          </button>
          <button className="btn btn-ghost text-xs" type="button" onClick={cancelEdit}>ביטול</button>
        </div>
      </div>
    );
  }

  function renderTableBody() {
    const colCount = 4;

    return monthGroups.map((group) => (
      <tbody key={group.month} className="tx-table-group">
        <tr className="tx-table-month">
          <td colSpan={colCount}>{monthLabelFromKey(group.month)}</td>
        </tr>
        {group.items.map((t) => {
          const category = t.categoryName ?? "ללא קטגוריה";
          const color = categoryColor(category);
          const { day, month } = dateParts(t.date);

          if (editState?.id === t.id) {
            return (
              <tr key={t.id} className="tx-table-edit-row">
                <td colSpan={colCount}>{renderEditForm(t)}</td>
              </tr>
            );
          }

          return (
            <tr
              key={t.id}
              className="tx-table-row tx-table-row--clickable"
              onClick={() => setDetailRow(t)}
            >
              <td className="tx-td-date">
                <span className="tx-date-day">{day}</span>
                <span className="tx-date-month">{month}</span>
              </td>
              <td className="tx-td-vendor">
                <span className="tx-vendor-name">{t.vendor}</span>
              </td>
              <td className="tx-td-category">
                <span className="tx-cat-pill">
                  <span className="cat-dot" style={{ background: color }} />
                  <span className="tx-cat-pill-text">{category}</span>
                </span>
              </td>
              <td className="tx-td-amount amount">{fmtAmount(t.amount)}</td>
            </tr>
          );
        })}
      </tbody>
    ));
  }

  function renderMobileCards() {
    return (
      <div className="tx-card-list">
        {monthGroups.map((group) => (
          <div key={group.month} className="tx-card-month-group">
            <div className="tx-card-month">{monthLabelFromKey(group.month)}</div>
            {group.items.map((t) => {
              const category = t.categoryName ?? "ללא קטגוריה";
              const color = categoryColor(category);
              const { day, month } = dateParts(t.date);

              if (editState?.id === t.id) {
                return (
                  <div key={t.id} className="tx-card tx-card--edit">
                    {renderEditForm(t)}
                  </div>
                );
              }

              return (
                <button
                  key={t.id}
                  type="button"
                  className="tx-card"
                  onClick={() => setDetailRow(t)}
                >
                  <div className="tx-card-date">
                    <span className="tx-date-day">{day}</span>
                    <span className="tx-date-month">{month}</span>
                  </div>
                  <div className="tx-card-body">
                    <div className="tx-card-top">
                      <span className="tx-vendor-name">{t.vendor}</span>
                      <strong className="tx-card-amount amount">{fmtAmount(t.amount)}</strong>
                    </div>
                    <div className="tx-card-meta">
                      <span className="tx-cat-pill">
                        <span className="cat-dot" style={{ background: color }} />
                        <span className="tx-cat-pill-text">{category}</span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  const activeCategories = props.categories;

  return (
    <div className="tx-page space-y-4">
      <section className="card tx-section dash-enter">
        <div className="card-head">
          <div>
            <h2>סיכום</h2>
            <p className="tx-muted">{selectedMonthLabel}</p>
          </div>
        </div>

        <div className="tx-stats">
          <div className="tx-stat tx-stat--hero">
            <span className="tx-stat-label">סה״כ</span>
            <span className="tx-stat-value amount">{fmtAmount(totalAmount)}</span>
          </div>
          <div className="tx-stat">
            <span className="tx-stat-label">תנועות</span>
            <span className="tx-stat-value">{filtered.length}</span>
          </div>
          <div className="tx-stat">
            <span className="tx-stat-label">אישי</span>
            <span className="tx-stat-value amount">{fmtAmount(personalTotal)}</span>
          </div>
          <div className="tx-stat">
            <span className="tx-stat-label">עסקי</span>
            <span className="tx-stat-value amount">{fmtAmount(businessTotal)}</span>
          </div>
        </div>
      </section>

      <section className="card tx-section dash-enter" style={{ animationDelay: "40ms" }}>
        <div className="card-head">
          <button
            type="button"
            className="tx-add-toggle"
            onClick={() => setAddOpen((v) => !v)}
            aria-expanded={addOpen}
          >
            <h3>תנועה חדשה</h3>
            <span className={`tx-add-toggle-icon${addOpen ? " is-open" : ""}`} aria-hidden>
              +
            </span>
          </button>
          <ImportStatementCard
            categories={props.categories}
            defaultCardLast4={cardLast4}
            onImported={() => void reload()}
          />
        </div>

        {addOpen ? (
          <form onSubmit={create} className="tx-add-form">
            <div className="tx-add-grid">
              <div>
                <label className="field-label">תאריך</label>
                <input className="field field-compact mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div>
                <label className="field-label">סכום ₪</label>
                <input className="field field-compact mt-1" value={amount}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if ((v.match(/\./g) ?? []).length <= 1) setAmount(v); }}
                  inputMode="decimal" placeholder="89.90" required />
              </div>
              <div>
                <label className="field-label">קטגוריה</label>
                <select className="field field-compact mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  {activeCategories.length === 0 && (
                    <option value="">הגדר תקציב תחילה</option>
                  )}
                  {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">אמצעי תשלום</label>
                <select
                  className="field field-compact mt-1"
                  value={paymentOptionId}
                  onChange={(e) => setPaymentOptionId(e.target.value)}
                  required
                >
                  {CHAT_PAYMENT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {paymentOptionId === "other" ? (
                <div className="tx-add-wide">
                  <label className="field-label">פרטי תשלום</label>
                  <input
                    className="field field-compact mt-1"
                    value={paymentOther}
                    onChange={(e) => setPaymentOther(e.target.value)}
                    placeholder="לדוגמה: מזומן / העברה"
                    required
                  />
                </div>
              ) : null}
              <div className="tx-add-wide">
                <label className="field-label">בית עסק</label>
                <input className="field field-compact mt-1" value={vendor} onChange={(e) => setVendor(e.target.value)} required placeholder="שם העסק" />
              </div>
              <div className="tx-add-wide">
                <label className="field-label">תיאור</label>
                <input className="field field-compact mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="אופציונלי" />
              </div>
              <div className="tx-add-submit">
                <button className="btn btn-primary btn-sm" type="submit" disabled={loading || !categoryId}>
                  + הוסף
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </section>

      <section className="card tx-section dash-enter" style={{ animationDelay: "80ms" }}>
        <div className="card-head">
          <div>
            <h3>כל התנועות</h3>
            <p className="tx-muted">{displayRows.length} תנועות · {selectedMonthLabel}</p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setDupesOpen(true)}
            disabled={duplicateGroups.length === 0}
            title={duplicateGroups.length === 0 ? "לא נמצאו כפילויות" : `${duplicateGroups.length} קבוצות`}
          >
            כפילויות{duplicateGroups.length > 0 ? ` (${duplicateGroups.length})` : ""}
          </button>
        </div>

        <div className="tx-toolbar">
          <div className="tx-toolbar-search">
            <input className="field field-compact" value={query}
              onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש…" aria-label="חיפוש" />
          </div>
          <select className="field field-compact tx-toolbar-field" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} aria-label="שנה">
            {Array.from({ length: 6 }, (_, i) => String(today.getFullYear() - i)).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="field field-compact tx-toolbar-field" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} aria-label="חודש">
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
              <option key={m} value={m}>{m.padStart(2, "0")}</option>
            ))}
          </select>
          <select
            className="field field-compact tx-toolbar-field tx-toolbar-field--payment"
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            aria-label="אמצעי תשלום"
          >
            <option value="all">כל אמצעי התשלום</option>
            <option value="__none__">ללא אמצעי תשלום</option>
            {paymentFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button className="btn btn-sm" type="button" onClick={reload} disabled={loading}>
            {loading ? "…" : "החל"}
          </button>
        </div>

        {error ? (
          <div className="tx-alert tx-alert--error">{error}</div>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="tx-empty-state">טוען תנועות…</div>
        ) : displayRows.length === 0 ? (
          <div className="tx-empty-state">אין תנועות לתקופה הזו</div>
        ) : (
          <>
            <div className="data-table-scroll tx-table-wrap tx-table-desktop">
              <table className="data-table tx-table tx-table--compact">
                <colgroup>
                  <col className="tx-col-date" />
                  <col className="tx-col-vendor" />
                  <col className="tx-col-category" />
                  <col className="tx-col-amount" />
                </colgroup>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>בית עסק</th>
                    <th>קטגוריה</th>
                    <th className="tx-th-amount">סכום</th>
                  </tr>
                </thead>
                {renderTableBody()}
              </table>
            </div>
            {renderMobileCards()}
          </>
        )}
      </section>

      <AppModal
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        label="פרטי תנועה"
        className="nf-modal--tx-detail"
      >
        {detailRow ? (
          <>
            <div className="nf-modal-head">
              <div className="min-w-0">
                <p className="tx-detail-kicker">פרטי תנועה</p>
                <h3 className="nf-modal-title">{detailRow.vendor}</h3>
              </div>
              <button type="button" className="tx-detail-close" onClick={() => setDetailRow(null)} aria-label="סגור">
                ✕
              </button>
            </div>

            <div className="tx-detail-amount-hero amount">{fmtAmount(detailRow.amount)}</div>

            <dl className="tx-detail-grid">
              <div>
                <dt>תאריך</dt>
                <dd>{new Date(detailRow.date).toLocaleDateString("he-IL")}</dd>
              </div>
              <div>
                <dt>קטגוריה</dt>
                <dd>{detailRow.categoryName ?? "ללא קטגוריה"}</dd>
              </div>
              <div>
                <dt>סוג</dt>
                <dd>
                  <span className={`tx-scope-tag tx-scope-tag--${detailRow.categoryScope === "business" ? "business" : "personal"}`}>
                    {detailRow.categoryScope === "business" ? "עסקי" : "אישי"}
                  </span>
                </dd>
              </div>
              <div>
                <dt>אמצעי תשלום</dt>
                <dd>{detailRow.cardLast4 ? detailRow.cardLast4 : "לא צוין"}</dd>
              </div>
              <div className="tx-detail-wide">
                <dt>תיאור</dt>
                <dd>{detailRow.description?.trim() ? detailRow.description : "אין תיאור"}</dd>
              </div>
            </dl>

            <div className="tx-detail-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const row = detailRow;
                  setDetailRow(null);
                  startEdit(row);
                }}
              >
                ערוך
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const id = detailRow.id;
                  setDetailRow(null);
                  void remove(id);
                }}
              >
                מחק
              </button>
            </div>
          </>
        ) : null}
      </AppModal>

      <AppModal
        open={dupesOpen}
        onClose={() => setDupesOpen(false)}
        label="כפילויות"
        wide
        className="nf-modal--sheet"
      >
            <div className="nf-modal-head">
              <div>
                <h3 className="nf-modal-title">כפילויות אפשריות</h3>
                <p className="nf-modal-sub">שמות דומים + אותו סכום</p>
              </div>
              <button type="button" className="tx-detail-close" onClick={() => setDupesOpen(false)} aria-label="סגור">
                ✕
              </button>
            </div>
            {duplicateGroups.length === 0 ? (
              <p className="nf-modal-empty">לא נמצאו כפילויות ברשימה הנוכחית.</p>
            ) : (
              <div className="space-y-4">
                {duplicateGroups.map(({ key, group }) => (
                  <div key={key} className="tx-dupe-group">
                    <p className="tx-dupe-group-title">
                      {group[0]!.vendor} · {fmtAmount(group[0]!.amount)} · {group.length} תנועות
                    </p>
                    <ul className="nf-modal-list">
                      {group.map((t) => (
                        <li key={t.id} className="nf-modal-list-item">
                          <div className="min-w-0">
                            <div className="nf-modal-list-title">{t.vendor}</div>
                            <div className="nf-modal-list-meta">
                              {new Date(t.date).toLocaleDateString("he-IL")}
                              {t.description ? ` · ${t.description}` : ""}
                              {t.categoryName ? ` · ${t.categoryName}` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => void remove(t.id)}
                          >
                            מחק
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
      </AppModal>
    </div>
  );
}
