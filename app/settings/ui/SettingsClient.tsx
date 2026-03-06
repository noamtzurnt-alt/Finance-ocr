"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type BusinessType = "exempt" | "licensed" | "company";

type SettingsProps = {
  initial: {
    businessType: BusinessType;
    businessName: string;
    taxId: string;
    vatPercent: string;
    phoneNumber: string;
    whatsappIncomingNumber: string;
  };
};

export default function SettingsClient({ initial }: SettingsProps) {
  const router = useRouter();
  const [form, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("שמירה נכשלה");
      
      setOk(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-5">
      <div>
        <label className="text-sm font-medium text-zinc-900">סוג עסק</label>
        <select
          className="field mt-1 w-full"
          value={form.businessType}
          onChange={(e) => setDraft({ ...form, businessType: e.target.value as BusinessType })}
        >
          <option value="exempt">עוסק פטור (ללא מע&quot;מ)</option>
          <option value="licensed">עוסק מורשה</option>
          <option value="company">חברה בע&quot;מ</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-900">שם העסק</label>
        <input
          className="field mt-1 w-full"
          value={form.businessName}
          onChange={(e) => setDraft({ ...form, businessName: e.target.value })}
          placeholder="למשל: נועם פתרונות דיגיטליים"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-900">ח.פ / ת.ז עסק</label>
        <input
          className="field mt-1 w-full"
          value={form.taxId}
          onChange={(e) => setDraft({ ...form, taxId: e.target.value })}
          placeholder="מספר עוסק / חברה"
        />
      </div>

      {form.businessType !== "exempt" && (
        <div>
          <label className="text-sm font-medium text-zinc-900">אחוז מע&quot;מ ברירת מחדל (%)</label>
          <input
            className="field mt-1 w-full"
            type="number"
            step="0.1"
            value={form.vatPercent}
            onChange={(e) => setDraft({ ...form, vatPercent: e.target.value })}
          />
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-zinc-900">מספר WhatsApp לקבלת קבלות (המספר של Twilio)</label>
        <input
          className="field mt-1 w-full"
          type="tel"
          value={form.whatsappIncomingNumber}
          onChange={(e) => setDraft({ ...form, whatsappIncomingNumber: e.target.value })}
          placeholder="למשל: 972501234567"
        />
        <p className="mt-1 text-xs text-zinc-500">
          כשהלקוח שולח תמונת קבלה למספר הזה (ה־WhatsApp העסקי שלך ב־Twilio), הקבלה נשמרת אוטומטית באתר שלך. הלקוח לא נכנס לאתר בכלל.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          ל-Production (מספר משלך, לקוחות בלי &quot;join&quot;): צריך לחבר Meta Business + WhatsApp Business + Twilio.{" "}
          <Link href="/settings/whatsapp-setup" className="underline font-medium text-zinc-700 hover:text-zinc-900">
            מדריך הגדרת WhatsApp ל-Production
          </Link>
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-900">מספר הטלפון שלי (שליחה ממני)</label>
        <input
          className="field mt-1 w-full"
          type="tel"
          value={form.phoneNumber}
          onChange={(e) => setDraft({ ...form, phoneNumber: e.target.value })}
          placeholder="050-1234567"
        />
        <p className="mt-1 text-xs text-zinc-500">
          אם גם אתה שולח קבלות מהטלפון שלך – המספר שתשלח ממנו יזוהה ויישמר בחשבון שלך.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-emerald-600 font-medium">ההגדרות נשמרו בהצלחה!</p>}

      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary w-full"
      >
        {saving ? "שומר..." : "שמור הגדרות"}
      </button>
    </form>
  );
}
