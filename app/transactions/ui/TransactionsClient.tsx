"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function monthLabelFromKey(key: string) {
  // key: YYYY-MM
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const dt = new Date(y, Math.max(0, m - 1), 1);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(dt);
}

type Category = { id: string; name: string };
type Row = {
  id: string;
  date: string;
  amount: string;
  currency: string;
  vendor: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
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
};

export default function TransactionsClient(props: { categories: Category[] }) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const editRef = useRef<HTMLTableRowElement | null>(null);

  const sortedCategories = useMemo(() => {
    const sorted = [...props.categories];
    sorted.sort((a, b) => {
      if (a.name === "כללי") return -1;
      if (b.name === "כללי") return 1;
      return a.name.localeCompare(b.name, "he");
    });
    return sorted;
  }, [props.categories]);

  const defaultCategoryId = useMemo(
    () => props.categories.find((c) => c.name === "כללי")?.id ?? props.categories[0]?.id ?? "",
    [props.categories],
  );

  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [cardLast4, setCardLast4] = useState("7374");

  // Keep categoryId in sync when categories load, and fetch initial data
  useEffect(() => {
    if (!categoryId && defaultCategoryId) setCategoryId(defaultCategoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCategoryId]);

  // Fetch current month's transactions on mount
  useEffect(() => {
    const now = new Date();
    const qs = new URLSearchParams({
      limit: "200",
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1),
    });
    fetch(`/api/transactions?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Row[]) => { setItems(data); setLoading(false); })
      .catch(() => { setError("שגיאה בטעינת תנועות"); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => (x.vendor + " " + (x.description ?? "")).toLowerCase().includes(q));
  }, [items, query]);

  const selectedMonthLabel = useMemo(() => {
    const mm = String(filterMonth).padStart(2, "0");
    return monthLabelFromKey(`${filterYear}-${mm}`);
  }, [filterYear, filterMonth]);

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
        cardLast4: cardLast4 || null,
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
    // keep category + card as convenience
    await reload();
  }

  async function remove(id: string) {
    if (!confirm("למחוק תנועה?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  }

  function startEdit(t: Row) {
    setEditState({
      id: t.id,
      date: t.date,
      amount: t.amount,
      vendor: t.vendor,
      description: t.description ?? "",
      categoryId: t.categoryId ?? "",
      cardLast4: t.cardLast4 ?? "",
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
              cardLast4: editState.cardLast4 || null,
            }
          : x,
      ),
    );
    setEditState(null);
  }

  // Category color map
  const CAT_COLORS: Record<string, string> = {
    "כללי":             "bg-zinc-100 text-zinc-600",
    "אוכל":             "bg-orange-100 text-orange-700",
    "דלק/רכב":          "bg-blue-100 text-blue-700",
    "תוכנות ומנויים":   "bg-violet-100 text-violet-700",
    "בגדים":            "bg-pink-100 text-pink-700",
  };
  function catColor(name: string | null) {
    return name ? (CAT_COLORS[name] ?? "bg-teal-100 text-teal-700") : "bg-zinc-100 text-zinc-400";
  }

  return (
    <div className="space-y-5">
      {/* Add form */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
          </div>
          <span className="font-semibold text-zinc-900">הוספת תנועה חדשה</span>
        </div>
        <form onSubmit={create} className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">תאריך</label>
            <input className="field mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="lg:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">סכום ₪</label>
            <input className="field mt-1.5" value={amount}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if ((v.match(/\./g) ?? []).length <= 1) setAmount(v); }}
              inputMode="decimal" placeholder="89.90" required />
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">בית עסק</label>
            <input className="field mt-1.5" value={vendor} onChange={(e) => setVendor(e.target.value)} required />
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">הערה</label>
            <input className="field mt-1.5" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="lg:col-span-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">קטגוריה</label>
            <select className="field mt-1.5" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {props.categories.length === 0 && <option value="">הוסף קטגוריות תחילה</option>}
              {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">כרטיס</label>
            <select className="field mt-1.5" value={cardLast4} onChange={(e) => setCardLast4(e.target.value)}>
              <option value="7374">•••• 7374</option>
              <option value="5622">•••• 5622</option>
              <option value="9537">•••• 9537</option>
              <option value="7539">•••• 7539</option>
            </select>
          </div>
          <div className="lg:col-span-2 flex items-end justify-end gap-2">
            <button className="btn btn-primary disabled:opacity-60" type="submit" disabled={loading}>
              + הוסף תנועה
            </button>
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              חיפוש · {selectedMonthLabel}
            </label>
            <input className="field mt-1.5" value={query}
              onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי בית עסק / הערה…" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">שנה</label>
            <select className="field mt-1.5" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              {Array.from({ length: 6 }, (_, i) => String(today.getFullYear() - i)).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">חודש</label>
            <select className="field mt-1.5" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                <option key={m} value={m}>{m.padStart(2, "0")}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn" type="button" onClick={reload} disabled={loading}>החל</button>
          </div>
          <div className="flex items-end">
            <span className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
              {filtered.length} תנועות
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          טוען תנועות…
        </div>
      ) : null}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>בית עסק</th>
              <th>קטגוריה</th>
              <th>סכום</th>
              <th>כרטיס</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="py-14 text-center text-zinc-400" colSpan={6}>
                  אין תנועות לחודש זה. הוסף תנועה למעלה.
                </td>
              </tr>
            ) : (
              (() => {
                const out: React.ReactNode[] = [];
                let lastMonth = "";
                for (const t of filtered) {
                  const m = t.date.slice(0, 7);
                  if (m !== lastMonth) {
                    lastMonth = m;
                    out.push(
                      <tr key={`m-${m}`} className="month-divider">
                        <td colSpan={6}>{monthLabelFromKey(m)}</td>
                      </tr>,
                    );
                  }
                  const isEditing = editState?.id === t.id;

                  if (isEditing) {
                    out.push(
                      <tr key={`edit-${t.id}`} ref={editRef} className="border-t-2 border-indigo-200 bg-indigo-50/40">
                        <td className="px-2 py-2">
                          <input className="field w-28" type="date" value={editState.date}
                            onChange={(e) => setEditState({ ...editState, date: e.target.value })} />
                        </td>
                        <td className="px-2 py-2 space-y-1.5">
                          <input className="field w-full" value={editState.vendor}
                            onChange={(e) => setEditState({ ...editState, vendor: e.target.value })} placeholder="בית עסק" />
                          <input className="field w-full" value={editState.description}
                            onChange={(e) => setEditState({ ...editState, description: e.target.value })} placeholder="הערה" />
                        </td>
                        <td className="px-2 py-2">
                          <select className="field" value={editState.categoryId}
                            onChange={(e) => setEditState({ ...editState, categoryId: e.target.value })}>
                            <option value="">—</option>
                            {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input className="field w-24" value={editState.amount}
                            onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if ((v.match(/\./g) ?? []).length <= 1) setEditState({ ...editState, amount: v }); }}
                            inputMode="decimal" placeholder="סכום" />
                        </td>
                        <td className="px-2 py-2">
                          <input className="field w-20" value={editState.cardLast4}
                            onChange={(e) => setEditState({ ...editState, cardLast4: e.target.value })}
                            placeholder="4 ספרות" maxLength={4} />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1.5">
                            <button className="btn btn-primary text-xs" type="button" onClick={() => void saveEdit()} disabled={saving}>
                              {saving ? "…" : "שמור"}
                            </button>
                            <button className="btn text-xs" type="button" onClick={cancelEdit}>ביטול</button>
                          </div>
                        </td>
                      </tr>,
                    );
                  } else {
                    out.push(
                      <tr key={t.id}>
                        <td className="text-zinc-500 text-xs">{t.date}</td>
                        <td>
                          <div className="font-medium text-zinc-900">{t.vendor}</div>
                          {t.description && <div className="mt-0.5 text-xs text-zinc-400">{t.description}</div>}
                        </td>
                        <td>
                          <span className={`cat-badge ${catColor(t.categoryName)}`}>
                            {t.categoryName ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span className="font-semibold text-zinc-900">{t.amount}</span>
                          <span className="mr-1 text-xs text-zinc-400">{t.currency}</span>
                        </td>
                        <td className="text-xs text-zinc-400">{t.cardLast4 ? `•••• ${t.cardLast4}` : "—"}</td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                              type="button" onClick={() => startEdit(t)} title="ערוך">
                              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M11.013 2.513a1.75 1.75 0 0 1 2.475 2.474L5.5 12.974l-3 .527.527-3 7.986-7.988Z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                              type="button" onClick={() => void remove(t.id)} title="מחק">
                              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>,
                    );
                  }
                }
                return out;
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

