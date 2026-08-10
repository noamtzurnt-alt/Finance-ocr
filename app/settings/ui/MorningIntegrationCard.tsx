"use client";

import { useEffect, useState } from "react";

type MorningEvent = {
  id: string;
  status: string;
  httpStatus: number;
  summary: string;
  detail: string | null;
  morningDocId: string | null;
  morningType: number | null;
  morningNumber: string | null;
  documentId: string | null;
  createdAt: string;
};

const MORNING_TYPE_LABELS: Record<number, string> = {
  10: "הצעת מחיר",
  100: "הזמנה",
  200: "תעודת משלוח",
  210: "תעודת החזרה",
  300: "חשבון עסקה",
  305: "חשבונית מס",
  320: "חשבונית מס / קבלה",
  330: "חשבונית זיכוי",
  400: "קבלה",
  405: "קבלה על תרומה",
  500: "הזמנת רכש",
  600: "קבלת פיקדון",
  610: "משיכת פיקדון",
};

const IMPORTED_TYPES = [400, 320, 405];

const STATUS_LABEL: Record<string, string> = {
  imported: "נקלט",
  skipped: "דולג",
  ignored: "התעלמות",
  error: "שגיאה",
  unauthorized: "לא מורשה",
  invalid_secret: "Secret שגוי",
  received: "התקבל",
};

function statusClass(status: string) {
  if (status === "imported") return "bg-emerald-100 text-emerald-800";
  if (status === "skipped" || status === "ignored") return "bg-amber-100 text-amber-900";
  if (status === "error" || status === "unauthorized" || status === "invalid_secret") {
    return "bg-red-100 text-red-800";
  }
  return "bg-zinc-100 text-zinc-700";
}

export default function MorningIntegrationCard() {
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<MorningEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"url" | "secret" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings/morning");
    if (!res.ok) return;
    const data = (await res.json()) as {
      enabled?: boolean;
      webhookUrl?: string | null;
      secret?: string | null;
      events?: MorningEvent[];
    };
    setEnabled(Boolean(data.enabled));
    setWebhookUrl(data.webhookUrl ?? null);
    setSecret(data.secret ?? null);
    setEvents(Array.isArray(data.events) ? data.events : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function enableOrRotate(action: "enable" | "rotate") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/morning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; webhookUrl?: string | null; secret?: string | null; enabled?: boolean }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "שגיאה");
        return;
      }
      setEnabled(Boolean(data?.enabled));
      setWebhookUrl(data?.webhookUrl ?? null);
      setSecret(data?.secret ?? null);
      await load();
    } catch {
      setError("שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!confirm("לכבות את חיבור Morning? קבלות חדשות לא ייכנסו אוטומטית.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/morning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      if (!res.ok) {
        setError("שגיאה");
        return;
      }
      setEnabled(false);
      setWebhookUrl(null);
      setSecret(null);
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "url" | "secret", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Morning (חשבונית ירוקה) → קבלות הכנסה</h2>
          <p className="mt-1 text-sm text-zinc-600">
            כשאתה מפיק קבלה / חשבונית-מס-קבלה ב־Morning, המערכת תקלוט אותה אוטומטית תחת{" "}
            <strong>קבלות הכנסות</strong> — בלי להעתיק מהמייל ידנית.
          </p>
        </div>
        <span
          className={[
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            enabled ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600",
          ].join(" ")}
        >
          {enabled ? "מחובר" : "כבוי"}
        </span>
      </div>

      {!enabled ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void enableOrRotate("enable")}
        >
          {busy ? "מפעיל..." : "הפעל חיבור Morning"}
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-500">כתובת URL להדבקה ב־Morning</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="field flex-1 font-mono text-xs"
                dir="ltr"
                readOnly
                value={webhookUrl ?? ""}
              />
              <button
                type="button"
                className="btn text-sm"
                onClick={() => webhookUrl && void copy("url", webhookUrl)}
              >
                {copied === "url" ? "✓ הועתק" : "העתק"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500">Secret — להדבקה בשדה Secret ב־Morning</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="field flex-1 font-mono text-xs"
                dir="ltr"
                readOnly
                value={secret ?? ""}
              />
              <button
                type="button"
                className="btn text-sm"
                onClick={() => secret && void copy("secret", secret)}
              >
                {copied === "secret" ? "✓ הועתק" : "העתק"}
              </button>
            </div>
          </div>

          <ol className="list-decimal space-y-1 pr-5 text-sm text-zinc-600">
            <li>
              ב־Morning: <strong>אזור אישי → כלים למפתחים → Webhooks</strong>
            </li>
            <li>הדבק את כתובת ה־URL למעלה</li>
            <li>
              בשדה <strong>Secret</strong> הדבק את הקוד מהשדה Secret למעלה
            </li>
            <li>
              נושאים: סמן <strong>יצירת מסמך (document/created)</strong>
            </li>
            <li>שמור — מהפקה הבאה של קבלה, היא תופיע כאן בקבלות הכנסות</li>
          </ol>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-2">
            <p className="text-sm font-semibold text-emerald-900">אילו מסמכים נקלטים אוטומטית?</p>
            <div className="flex flex-wrap gap-1.5">
              {IMPORTED_TYPES.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
                >
                  ✓ {MORNING_TYPE_LABELS[t]}
                </span>
              ))}
            </div>
            <p className="text-xs text-emerald-800/80">
              מסמכים אחרים — כמו <strong>חשבון עסקה</strong>, <strong>חשבונית מס</strong> (בלי קבלה) או{" "}
              <strong>הצעת מחיר</strong> — אינם קבלות, ולכן המערכת מדלגת עליהם בכוונה (יופיעו בלוג
              כ״דולג״).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn text-sm"
              disabled={busy}
              onClick={() => void enableOrRotate("rotate")}
            >
              החלף מפתחות
            </button>
            <button type="button" className="btn text-sm" disabled={busy} onClick={() => void disable()}>
              כבה
            </button>
            <button type="button" className="btn text-sm" disabled={busy} onClick={() => void load()}>
              רענן לוגים
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-100 pt-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">לוג קליטות Morning</h3>
          <span className="text-xs text-zinc-500">{events.length} אחרונים</span>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">עדיין אין אירועים. אחרי הפקת קבלה ב־Morning יופיע כאן מה קרה.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(ev.status)}`}>
                        {STATUS_LABEL[ev.status] ?? ev.status}
                      </span>
                      <span className="text-xs text-zinc-500" dir="ltr">
                        HTTP {ev.httpStatus}
                      </span>
                      {ev.morningType != null ? (
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            IMPORTED_TYPES.includes(ev.morningType)
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-zinc-100 text-zinc-600",
                          ].join(" ")}
                        >
                          {MORNING_TYPE_LABELS[ev.morningType] ?? `סוג ${ev.morningType}`}
                        </span>
                      ) : null}
                      {ev.morningNumber ? (
                        <span className="text-xs text-zinc-500">#{ev.morningNumber}</span>
                      ) : null}
                    </div>
                    <p className="text-zinc-800">{ev.summary}</p>
                    <p className="text-xs text-zinc-500" dir="ltr">
                      {new Date(ev.createdAt).toLocaleString("he-IL")}
                    </p>
                  </div>
                  {ev.detail ? (
                    <button
                      type="button"
                      className="btn text-xs shrink-0"
                      onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    >
                      {expandedId === ev.id ? "הסתר פרטים" : "פרטים"}
                    </button>
                  ) : null}
                </div>
                {expandedId === ev.id && ev.detail ? (
                  <pre
                    className="mt-2 max-h-48 overflow-auto rounded-lg bg-white p-2 text-[11px] text-zinc-700 border border-zinc-100"
                    dir="ltr"
                  >
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
