"use client";

import { useEffect, useMemo, useState } from "react";
import GmailSyncButton from "@/app/ui/GmailSyncButton";

export type ContractRow = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  contractDate: string | null;
  details: string | null;
  fileName: string;
  fileMime: string;
  fileSize: number;
  hasEmailHtml: boolean;
  importedFromGmail: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.includes("pdf")) return "📄";
  return "📎";
}

export default function ContractsClient(props: { initial: ContractRow[] }) {
  const [items, setItems] = useState<ContractRow[]>(props.initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [clientName, setClientName] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [details, setDetails] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(props.initial);
  }, [props.initial]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (x) =>
        x.clientName.toLowerCase().includes(q) ||
        (x.clientEmail ?? "").toLowerCase().includes(q) ||
        (x.details ?? "").toLowerCase().includes(q) ||
        x.fileName.toLowerCase().includes(q),
    );
  }, [items, query]);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/contracts");
    setLoading(false);
    if (!res.ok) {
      setError("לא הצלחנו לטעון חוזים");
      return;
    }
    setItems((await res.json()) as ContractRow[]);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("יש לצרף קובץ חוזה");
      return;
    }
    setSaving(true);
    setError(null);

    const form = new FormData();
    form.append("clientName", clientName.trim());
    if (contractDate) form.append("contractDate", contractDate);
    if (details.trim()) form.append("details", details.trim());
    form.append("file", file);

    const res = await fetch("/api/contracts", { method: "POST", body: form });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאה בשמירה");
      return;
    }

    setClientName("");
    setContractDate("");
    setDetails("");
    setFile(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("למחוק את החוזה?")) return;
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-emerald-900">קליטת חוזים אוטומטית פעילה</p>
          <p className="text-xs text-emerald-800">
            חוזים חתומים שמגיעים ל־ntdigitaldomain@gmail.com נשמרים כאן עם ה־PDF והמייל המקורי.
          </p>
        </div>
        <GmailSyncButton purpose="contracts" onDone={load} />
      </div>

      <form
        onSubmit={create}
        className="grid gap-4 rounded-2xl border border-violet-200/70 bg-gradient-to-l from-violet-50/80 to-purple-50/50 p-5 sm:grid-cols-2"
      >
        <div>
          <label className="text-sm font-medium">שם לקוח</label>
          <input
            className="field mt-1"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="למשל: חברת ABC"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">תאריך חוזה</label>
          <input
            className="field mt-1"
            type="date"
            value={contractDate}
            onChange={(e) => setContractDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">פרטים / הערות</label>
          <textarea
            className="field mt-1 min-h-[88px] resize-y"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="תנאים, משך החוזה, סכום, הערות..."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">קובץ חוזה (תמונה או PDF)</label>
          <input
            className="mt-1 block w-full text-sm"
            type="file"
            accept="image/*,application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          {file ? (
            <p className="mt-1 text-xs text-zinc-500">
              {fileIcon(file.type)} {file.name} · {formatSize(file.size)}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "שומר..." : "הוסף חוזה"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-3">
        <input
          className="field flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי לקוח, אימייל, פרטים או שם קובץ..."
        />
        <button type="button" className="btn" onClick={() => void load()}>
          רענן
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-600">טוען...</p>
      ) : filtered.length === 0 ? (
        <div className="card py-14 text-center text-zinc-400">
          אין חוזים עדיין — הוסף לקוח וצרף את קובץ החוזה למעלה
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <ContractCard key={c.id} item={c} onDelete={remove} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContractCard(props: {
  item: ContractRow;
  onDelete: (id: string) => Promise<void>;
  onUpdated: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientName, setClientName] = useState(props.item.clientName);
  const [contractDate, setContractDate] = useState(
    props.item.contractDate ? props.item.contractDate.slice(0, 10) : "",
  );
  const [details, setDetails] = useState(props.item.details ?? "");
  const [file, setFile] = useState<File | null>(null);

  async function save() {
    setBusy(true);
    const form = new FormData();
    form.append("clientName", clientName.trim());
    form.append("contractDate", contractDate);
    form.append("details", details.trim());
    if (file) form.append("file", file);

    const res = await fetch(`/api/contracts/${props.item.id}`, { method: "PATCH", body: form });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      setFile(null);
      await props.onUpdated();
    }
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {editing ? (
            <input className="field" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-zinc-900">{props.item.clientName}</h3>
              {props.item.importedFromGmail ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  נקלט מ־Gmail
                </span>
              ) : null}
            </div>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            {props.item.contractDate
              ? new Date(props.item.contractDate).toLocaleDateString("he-IL")
              : "ללא תאריך"}
          </p>
          {!editing && props.item.clientEmail ? (
            <p className="mt-1 truncate text-xs text-zinc-500" dir="ltr">
              {props.item.clientEmail}
            </p>
          ) : null}
        </div>
        <span className="text-2xl">{fileIcon(props.item.fileMime)}</span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            className="field"
            type="date"
            value={contractDate}
            onChange={(e) => setContractDate(e.target.value)}
          />
          <textarea
            className="field min-h-[72px] resize-y"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <input
            type="file"
            accept="image/*,application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : props.item.details ? (
        <p className="line-clamp-3 text-sm text-zinc-600">{props.item.details}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        <a
          className="btn text-sm"
          href={`/api/contracts/${props.item.id}/view`}
          target="_blank"
          rel="noreferrer"
        >
          צפה ב־PDF
        </a>
        {props.item.hasEmailHtml ? (
          <a
            className="btn text-sm"
            href={`/api/contracts/${props.item.id}/view?file=email`}
            target="_blank"
            rel="noreferrer"
          >
            צפה במייל HTML
          </a>
        ) : null}
        {editing ? (
          <>
            <button type="button" className="btn btn-primary text-sm" onClick={() => void save()} disabled={busy}>
              {busy ? "שומר..." : "שמור"}
            </button>
            <button type="button" className="btn text-sm" onClick={() => setEditing(false)} disabled={busy}>
              ביטול
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn text-sm" onClick={() => setEditing(true)}>
              ערוך
            </button>
            <button type="button" className="btn text-sm" onClick={() => void props.onDelete(props.item.id)}>
              מחק
            </button>
          </>
        )}
        <span className="mr-auto truncate text-xs text-zinc-400">{props.item.fileName}</span>
      </div>
    </div>
  );
}
