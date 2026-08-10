"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type GmailConnection = {
  id: string;
  emailAddress: string;
  lastSyncAt: string | null;
  lastError: string | null;
  syncStatus: string;
};

type EmailEvent = {
  id: string;
  status: string;
  summary: string;
  detail: string | null;
  subject: string | null;
  sender: string | null;
  documentId: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  imported: "נקלט",
  contract_imported: "חוזה נקלט",
  skipped: "דולג",
  duplicate: "כפילות",
  not_receipt: "לא קבלה",
  error: "שגיאה",
};

function statusClass(status: string) {
  if (status === "imported" || status === "contract_imported") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "duplicate" || status === "skipped" || status === "not_receipt") return "bg-amber-100 text-amber-900";
  if (status === "error") return "bg-red-100 text-red-800";
  return "bg-zinc-100 text-zinc-700";
}

const CONTRACTS_INBOX = "ntdigitaldomain@gmail.com";
const RECEIPTS_INBOX = "noamtzurnt@gmail.com";

function accountRole(email: string): { label: string; active: boolean; syncLabel: string } | null {
  const lower = email.toLowerCase();
  if (lower === CONTRACTS_INBOX) return { label: "קליטת חוזים פעילה", active: true, syncLabel: "סנכרן חוזים" };
  if (lower === RECEIPTS_INBOX) return { label: "קליטת קבלות ירוקות פעילה", active: true, syncLabel: "סנכרן קבלות" };
  return null;
}

export default function GmailIntegrationCard() {
  const [connections, setConnections] = useState<GmailConnection[]>([]);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings/gmail");
    if (!res.ok) return;
    const data = (await res.json()) as {
      connections?: GmailConnection[];
      events?: EmailEvent[];
      configured?: boolean;
    };
    setConnections(data.connections ?? []);
    setEvents(data.events ?? []);
    setConfigured(Boolean(data.configured));
  }

  useEffect(() => {
    void load();
  }, []);

  async function syncOne(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/settings/gmail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "סנכרון נכשל");
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(id: string) {
    if (!confirm("לנתק את חשבון Gmail?")) return;
    setBusy(id);
    await fetch(`/api/settings/gmail/${id}`, { method: "DELETE" });
    await load();
    setBusy(null);
  }

  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Gmail → חוזים וקבלות</h2>
          <p className="mt-1 text-sm text-zinc-600">
            שני חשבונות בלבד בשימוש: חוזים חתומים מ־
            <span dir="ltr" className="font-medium">ntdigitaldomain@gmail.com</span> נשמרים בעמוד חוזים,
            וקבלות חשבונית ירוקה מ־
            <span dir="ltr" className="font-medium">noamtzurnt@gmail.com</span> נשמרות בקבלות הכנסות.
          </p>
        </div>
        {configured ? (
          <Link href="/api/auth/gmail/connect" className="btn btn-primary text-sm">
            חבר Gmail
          </Link>
        ) : (
          <span className="text-xs text-amber-700">נדרש הגדרת Google OAuth בשרת</span>
        )}
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-zinc-500">עדיין לא חובר חשבון Gmail.</p>
      ) : (
        <ul className="space-y-2">
          {connections.map((c) => {
            const role = accountRole(c.emailAddress);
            return (
              <li key={c.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" dir="ltr">{c.emailAddress}</span>
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          role ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600",
                        ].join(" ")}
                      >
                        {role ? role.label : "לא בשימוש"}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      סנכרון אחרון:{" "}
                      {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString("he-IL") : "טרם בוצע"}
                      {c.lastError ? ` · שגיאה: ${c.lastError}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {role ? (
                      <button type="button" className="btn text-xs" disabled={busy === c.id} onClick={() => void syncOne(c.id)}>
                        {busy === c.id ? "מסנכרן..." : role.syncLabel}
                      </button>
                    ) : null}
                    <button type="button" className="btn text-xs" disabled={busy === c.id} onClick={() => void disconnect(c.id)}>
                      נתק
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-zinc-100 pt-4 space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900">לוג קליטות מייל</h3>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">עדיין אין אירועים.</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-auto">
            {events.map((ev) => (
              <li key={ev.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(ev.status)}`}>
                        {STATUS_LABEL[ev.status] ?? ev.status}
                      </span>
                      <span className="text-xs text-zinc-500" dir="ltr">
                        {new Date(ev.createdAt).toLocaleString("he-IL")}
                      </span>
                    </div>
                    <p className="text-zinc-800">{ev.summary}</p>
                    {ev.subject ? <p className="text-xs text-zinc-500 truncate">{ev.subject}</p> : null}
                  </div>
                  {ev.detail ? (
                    <button type="button" className="btn text-xs shrink-0" onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}>
                      {expandedId === ev.id ? "הסתר" : "פרטים"}
                    </button>
                  ) : null}
                </div>
                {expandedId === ev.id && ev.detail ? (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white p-2 text-[11px] border border-zinc-100" dir="ltr">
                    {ev.detail}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
