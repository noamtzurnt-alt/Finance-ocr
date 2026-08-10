"use client";

import { useState } from "react";

type YearRow = {
  year: number;
  deposits: string;
  withdrawals: string;
  feesPaid: string;
  taxPaid: string;
  endBalance: string;
};

type EntryType = "deposit" | "withdrawal" | "fee" | "tax";

type Entry = {
  id: string;
  type: EntryType;
  date: string; // YYYY-MM-DD
  amount: string;
  note: string;
};

type Account = {
  id: string;
  slug: string;
  name: string;
  provider: string | null;
  strategy: string | null;
  notes?: string;
  currency: string;
  currentBalance: string;
  currentBalanceUpdatedAt: string;
  years: YearRow[];
  entries: Entry[];
};

function money(n: string) {
  const x = Number(String(n).replace(/,/g, "")) || 0;
  return x.toFixed(2);
}

function moneyNum(n: string) {
  return Number(money(n));
}

function formatILS(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(n);
}

function labelType(t: EntryType) {
  if (t === "deposit") return "הפקדה";
  if (t === "withdrawal") return "משיכה";
  if (t === "fee") return "עמלה";
  return "מס";
}

export default function InvestmentsClient(props: { years: number[]; initial: Account[] }) {
  const [items, setItems] = useState<Account[]>(props.initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<{
    accountId: string;
    year: number;
    type: EntryType;
    date: string;
    amount: string;
    note: string;
  } | null>(null);

  function getYearRow(a: Account, year: number): YearRow {
    return (
      a.years.find((y) => y.year === year) ?? {
        year,
        deposits: "0",
        withdrawals: "0",
        feesPaid: "",
        taxPaid: "",
        endBalance: "",
      }
    );
  }

  function yearKey(accountId: string, year: number) {
    return `${accountId}:${year}`;
  }

  function getEntriesForYear(a: Account, year: number) {
    const prefix = `${year}-`;
    return a.entries.filter((e) => e.date.startsWith(prefix));
  }

  function sumForYear(a: Account, year: number, type: EntryType): number {
    const sumEntries = getEntriesForYear(a, year)
      .filter((e) => e.type === type)
      .reduce((s, e) => s + moneyNum(e.amount), 0);

    // Backwards-compat fallback if the user already filled the old yearly totals.
    if (sumEntries === 0) {
      const row = getYearRow(a, year);
      if (type === "deposit") return moneyNum(row.deposits);
      if (type === "withdrawal") return moneyNum(row.withdrawals);
      if (type === "fee") return moneyNum(row.feesPaid || "0");
      if (type === "tax") return moneyNum(row.taxPaid || "0");
    }

    return sumEntries;
  }

  async function saveCurrentBalance(accountId: string, currentBalance: string) {
    setSaving(`bal:${accountId}`);
    setError(null);
    const res = await fetch(`/api/investments/account/${accountId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentBalance: currentBalance.trim() ? currentBalance : null }),
    });
    setSaving(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שמירה נכשלה");
      return;
    }
    setItems((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, currentBalanceUpdatedAt: currentBalance.trim() ? new Date().toISOString() : "" } : a,
      ),
    );
  }

  async function createEntry(row: { accountId: string; type: EntryType; date: string; amount: string; note: string }) {
    setSaving(`entry:${row.accountId}:${row.date}`);
    setError(null);
    const res = await fetch("/api/investments/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
    });
    setSaving(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שמירה נכשלה");
      return;
    }
    const body = (await res.json().catch(() => null)) as { ok?: boolean; id?: string } | null;
    const newId = body?.id;
    if (!body?.ok || typeof newId !== "string") {
      setError("שמירה נכשלה");
      return;
    }

    setItems((prev) =>
      prev.map((a) =>
        a.id === row.accountId
          ? {
              ...a,
              entries: [
                ...a.entries,
                { id: newId, type: row.type, date: row.date, amount: money(row.amount), note: row.note || "" },
              ].sort((x, y) => x.date.localeCompare(y.date)),
            }
          : a,
      ),
    );
    setDraft(null);
  }

  async function deleteEntry(accountId: string, entryId: string) {
    setSaving(`del:${entryId}`);
    setError(null);
    const res = await fetch(`/api/investments/entries/${entryId}`, { method: "DELETE" });
    setSaving(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "מחיקה נכשלה");
      return;
    }
    setItems((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, entries: a.entries.filter((e) => e.id !== entryId) } : a)),
    );
  }

  const totalAllDeposits = items.reduce((s, a) => s + props.years.reduce((ss, y) => ss + sumForYear(a, y, "deposit"), 0), 0);
  const totalAllWithdrawals = items.reduce(
    (s, a) => s + props.years.reduce((ss, y) => ss + sumForYear(a, y, "withdrawal"), 0),
    0,
  );

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="card p-4">
        <div className="text-sm font-semibold text-zinc-900">סיכום כללי</div>
        <div className="mt-2 text-sm text-zinc-700">
          הפקדות מ־2024: <span className="font-semibold text-zinc-900">{formatILS(totalAllDeposits)}</span> · משיכות:{" "}
          <span className="font-semibold text-zinc-900">{formatILS(totalAllWithdrawals)}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-6 text-center text-zinc-600">
          <p className="font-medium">אין חשבונות השקעות</p>
          <p className="mt-1 text-sm">אם יש לך חשבונות (קופת גמל, BTB וכו') – צור קשר להגדרה.</p>
        </div>
      ) : null}

      {items.map((acc) => {
        const totalDeposits = props.years.reduce((s, y) => s + sumForYear(acc, y, "deposit"), 0);
        const totalWithdrawals = props.years.reduce((s, y) => s + sumForYear(acc, y, "withdrawal"), 0);
        const bal = acc.currentBalance.trim() ? moneyNum(acc.currentBalance) : null;
        const balUpdated = acc.currentBalanceUpdatedAt ? new Date(acc.currentBalanceUpdatedAt) : null;
        return (
          <div key={acc.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{acc.name}</div>
                <div className="mt-1 text-xs text-zinc-600">
                  {acc.provider ? `${acc.provider} · ` : ""}
                  {acc.strategy ?? ""}
                </div>
                {acc.notes?.trim() ? (
                  <div className="mt-2 text-xs text-zinc-700 whitespace-pre-line">{acc.notes.trim()}</div>
                ) : null}
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm">
                  <div className="text-[11px] font-medium text-zinc-600">יתרה נוכחית</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
                    {bal == null ? "לא עודכן" : formatILS(bal)}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    {balUpdated ? `עודכן: ${balUpdated.toLocaleDateString("he-IL")}` : "לא עודכן"}
                  </div>
                </div>

                <div className="min-w-[220px]">
                  <div className="text-sm text-zinc-600">
                    הפקדות מ־2024: <span className="font-semibold text-zinc-900">{formatILS(totalDeposits)}</span>
                    <span className="mx-2 text-zinc-300">·</span>
                    משיכות: <span className="font-semibold text-zinc-900">{formatILS(totalWithdrawals)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="field"
                      value={acc.currentBalance}
                      onChange={(e) =>
                        setItems((prev) => prev.map((a) => (a.id === acc.id ? { ...a, currentBalance: e.target.value } : a)))
                      }
                      inputMode="decimal"
                      placeholder="יתרה נוכחית (₪)"
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving === `bal:${acc.id}`}
                      onClick={() => void saveCurrentBalance(acc.id, acc.currentBalance)}
                    >
                      {saving === `bal:${acc.id}` ? "שומר…" : "שמור"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-700">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">שנה</th>
                    <th className="px-3 py-2 text-right font-medium">הפקדות</th>
                    <th className="px-3 py-2 text-right font-medium">משיכות</th>
                    <th className="px-3 py-2 text-right font-medium">עמלות</th>
                    <th className="px-3 py-2 text-right font-medium">מס</th>
                    <th className="px-3 py-2 text-right font-medium">פרטים</th>
                  </tr>
                </thead>
                <tbody>
                  {props.years.map((y) => {
                    const k = yearKey(acc.id, y);
                    const deposits = sumForYear(acc, y, "deposit");
                    const withdrawals = sumForYear(acc, y, "withdrawal");
                    const fees = sumForYear(acc, y, "fee");
                    const tax = sumForYear(acc, y, "tax");
                    const isOpen = !!open[k];
                    return (
                      <tr key={y} className="border-t border-zinc-100">
                        <td className="px-3 py-2 font-medium text-zinc-900">{y}</td>
                        <td className="px-3 py-2">
                          {formatILS(deposits)}
                        </td>
                        <td className="px-3 py-2">{formatILS(withdrawals)}</td>
                        <td className="px-3 py-2">{formatILS(fees)}</td>
                        <td className="px-3 py-2">{formatILS(tax)}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setOpen((p) => ({ ...p, [k]: !p[k] }))}
                          >
                            {isOpen ? "סגור" : "פרטים"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {props.years.map((y) => {
              const k = yearKey(acc.id, y);
              if (!open[k]) return null;
              const yearEntries = getEntriesForYear(acc, y).sort((a, b) => a.date.localeCompare(b.date));
              const showDraft = draft && draft.accountId === acc.id && draft.year === y;
              return (
                <div key={k} className="mt-3 rounded-2xl border border-zinc-200/70 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-900">תנועות {y}</div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        setDraft({
                          accountId: acc.id,
                          year: y,
                          type: "deposit",
                          date:
                            String(new Date().getFullYear()) === String(y)
                              ? new Date().toISOString().slice(0, 10)
                              : `${y}-01-01`,
                          amount: "",
                          note: "",
                        })
                      }
                    >
                      הוסף הפקדה
                    </button>
                  </div>

                  {showDraft ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-5">
                      <select
                        className="field"
                        value={draft.type}
                        onChange={(e) => setDraft((p) => (p ? { ...p, type: e.target.value as EntryType } : p))}
                      >
                        <option value="deposit">הפקדה</option>
                        <option value="withdrawal">משיכה</option>
                        <option value="fee">עמלה</option>
                        <option value="tax">מס</option>
                      </select>
                      <input
                        className="field"
                        type="date"
                        value={draft.date}
                        onChange={(e) => setDraft((p) => (p ? { ...p, date: e.target.value } : p))}
                      />
                      <input
                        className="field"
                        value={draft.amount}
                        onChange={(e) => setDraft((p) => (p ? { ...p, amount: e.target.value } : p))}
                        inputMode="decimal"
                        placeholder="סכום"
                      />
                      <input
                        className="field"
                        value={draft.note}
                        onChange={(e) => setDraft((p) => (p ? { ...p, note: e.target.value } : p))}
                        placeholder="הערה (אופציונלי)"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={saving != null}
                          onClick={() => (draft ? void createEntry(draft) : undefined)}
                        >
                          {saving ? "שומר…" : "שמור"}
                        </button>
                        <button type="button" className="btn" disabled={saving != null} onClick={() => setDraft(null)}>
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-100">
                    {yearEntries.length === 0 ? (
                      <div className="p-3 text-sm text-zinc-600">אין תנועות לשנה הזו עדיין.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-zinc-700">
                          <tr>
                            <th className="px-3 py-2 text-right font-medium">תאריך</th>
                            <th className="px-3 py-2 text-right font-medium">סוג</th>
                            <th className="px-3 py-2 text-right font-medium">סכום</th>
                            <th className="px-3 py-2 text-right font-medium">הערה</th>
                            <th className="px-3 py-2 text-right font-medium">פעולה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearEntries.map((e) => (
                            <tr key={e.id} className="border-t border-zinc-100">
                              <td className="px-3 py-2 text-zinc-900">{e.date}</td>
                              <td className="px-3 py-2 text-zinc-700">{labelType(e.type)}</td>
                              <td className="px-3 py-2 font-medium text-zinc-900">{formatILS(moneyNum(e.amount))}</td>
                              <td className="px-3 py-2 text-zinc-700">{e.note || ""}</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={saving === `del:${e.id}`}
                                  onClick={() => void deleteEntry(acc.id, e.id)}
                                >
                                  {saving === `del:${e.id}` ? "מוחק…" : "מחק"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

