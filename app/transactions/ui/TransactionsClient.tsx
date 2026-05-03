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

export default function TransactionsClient(props: { categories: Category[]; initial: Row[] }) {
  const [items, setItems] = useState<Row[]>(props.initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const editRef = useRef<HTMLTableRowElement | null>(null);

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

  // Keep categoryId in sync when categories load
  useEffect(() => {
    if (!categoryId && defaultCategoryId) setCategoryId(defaultCategoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCategoryId]);

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

  useEffect(() => {
    setItems(props.initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props.initial)]);

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

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 lg:grid-cols-6">
        <div className="lg:col-span-1">
          <label className="text-sm font-medium">תאריך</label>
          <input className="field mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="lg:col-span-1">
          <label className="text-sm font-medium">סכום</label>
          <input
            className="field mt-1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="למשל 89.90"
            required
          />
        </div>
        <div className="lg:col-span-2">
          <label className="text-sm font-medium">בית עסק</label>
          <input className="field mt-1" value={vendor} onChange={(e) => setVendor(e.target.value)} required />
        </div>
        <div className="lg:col-span-2">
          <label className="text-sm font-medium">הערה</label>
          <input className="field mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="lg:col-span-3">
          <label className="text-sm font-medium">קטגוריה</label>
          <select className="field mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {props.categories.length === 0 && <option value="">אין קטגוריות — הוסף בעמוד קטגוריות</option>}
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-1">
          <label className="text-sm font-medium">כרטיס אשראי</label>
          <select className="field mt-1" value={cardLast4} onChange={(e) => setCardLast4(e.target.value)}>
            <option value="7374">•••• 7374 (ברירת מחדל)</option>
            <option value="5622">•••• 5622 (בהצדעה)</option>
            <option value="9537">•••• 9537 (חיוב מידי)</option>
            <option value="7539">•••• 7539 (עסקי)</option>
          </select>
        </div>
        <div className="lg:col-span-2 flex items-end justify-end gap-2">
          <button className="btn" type="button" onClick={reload} disabled={loading}>
            רענן
          </button>
          <button className="btn btn-primary disabled:opacity-60" type="submit" disabled={loading}>
            הוסף תנועה
          </button>
        </div>
      </form>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
        <div>
          <label className="text-sm font-medium">חיפוש חופשי</label>
          <div className="mt-1 text-xs text-zinc-600">
            מציג לפי חודש: <span className="font-semibold text-zinc-900">{selectedMonthLabel}</span>
          </div>
          <input
            className="field mt-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי בית עסק / הערה…"
          />
        </div>
        <div>
          <label className="text-sm font-medium">שנה</label>
          <select className="field mt-1" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            {Array.from({ length: 6 }, (_, i) => String(today.getFullYear() - i)).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">חודש</label>
          <select className="field mt-1" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1);
              return (
                <option key={m} value={m}>
                  {m.padStart(2, "0")}
                </option>
              );
            })}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button className="btn" type="button" onClick={reload} disabled={loading}>
            החל פילטר
          </button>
          <div className="text-sm text-zinc-600">
            סה״כ: <span className="font-semibold text-zinc-900">{filtered.length}</span>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-zinc-600">טוען…</p> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-3 py-2 text-right font-medium">תאריך</th>
              <th className="px-3 py-2 text-right font-medium">בית עסק</th>
              <th className="px-3 py-2 text-right font-medium">קטגוריה</th>
              <th className="px-3 py-2 text-right font-medium">סכום</th>
              <th className="px-3 py-2 text-right font-medium">כרטיס</th>
              <th className="px-3 py-2 text-right font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-12 text-center text-zinc-600" colSpan={6}>
                  אין תנועות. הוסף תנועה למעלה.
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
                      <tr key={`m-${m}`} className="bg-zinc-50/60">
                        <td className="px-3 py-2 text-xs font-semibold text-zinc-700" colSpan={6}>
                          {monthLabelFromKey(m)}
                        </td>
                      </tr>,
                    );
                  }
                  const isEditing = editState?.id === t.id;

                  if (isEditing) {
                    out.push(
                      <tr key={`edit-${t.id}`} ref={editRef} className="border-t border-blue-200 bg-blue-50/60">
                        <td className="px-2 py-2">
                          <input className="field w-28" type="date" value={editState.date} onChange={(e) => setEditState({ ...editState, date: e.target.value })} />
                        </td>
                        <td className="px-2 py-2 space-y-1">
                          <input className="field w-full" value={editState.vendor} onChange={(e) => setEditState({ ...editState, vendor: e.target.value })} placeholder="בית עסק" />
                          <input className="field w-full" value={editState.description} onChange={(e) => setEditState({ ...editState, description: e.target.value })} placeholder="הערה (אופציונלי)" />
                        </td>
                        <td className="px-2 py-2">
                          <select className="field" value={editState.categoryId} onChange={(e) => setEditState({ ...editState, categoryId: e.target.value })}>
                            <option value="">—</option>
                            {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input className="field w-24" value={editState.amount} onChange={(e) => setEditState({ ...editState, amount: e.target.value })} inputMode="decimal" placeholder="סכום" />
                        </td>
                        <td className="px-2 py-2">
                          <input className="field w-20" value={editState.cardLast4} onChange={(e) => setEditState({ ...editState, cardLast4: e.target.value })} placeholder="4 ספרות" maxLength={4} />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            <button className="btn btn-primary" type="button" onClick={() => void saveEdit()} disabled={saving}>
                              {saving ? "…" : "שמור"}
                            </button>
                            <button className="btn" type="button" onClick={cancelEdit}>ביטול</button>
                          </div>
                        </td>
                      </tr>,
                    );
                  } else {
                    out.push(
                      <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                        <td className="px-3 py-2">{t.date}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-zinc-900">{t.vendor}</div>
                          {t.description ? <div className="mt-0.5 text-xs text-zinc-600">{t.description}</div> : null}
                        </td>
                        <td className="px-3 py-2">{t.categoryName ?? "—"}</td>
                        <td className="px-3 py-2">
                          {t.amount} <span className="text-xs text-zinc-600">{t.currency}</span>
                        </td>
                        <td className="px-3 py-2">{t.cardLast4 ? `•••• ${t.cardLast4}` : "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button className="btn" type="button" onClick={() => startEdit(t)} title="ערוך">
                              ✏️
                            </button>
                            <button className="btn" type="button" onClick={() => void remove(t.id)}>
                              מחק
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

