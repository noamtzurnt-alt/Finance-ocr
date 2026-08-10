"use client";

import { useState } from "react";

type SettingsProps = {
  email: string;
};

export default function SettingsClient({ email }: SettingsProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);

    if (newPassword !== confirmPassword) {
      setError("הסיסמה החדשה ואימות הסיסמה לא תואמים");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "שמירה נכשלה");

      setOk(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-5">
      <div>
        <label className="text-sm font-medium text-zinc-900">שם משתמש (אימייל)</label>
        <input
          className="field mt-1 w-full bg-zinc-50 text-zinc-700"
          value={email}
          readOnly
          dir="ltr"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-4">
        <p className="text-sm font-medium text-zinc-900">שינוי סיסמה</p>
        <p className="text-xs text-zinc-500">
          מטעמי אבטחה הסיסמה הנוכחית לא מוצגת. כדי לעדכן — הזן את הסיסמה הנוכחית ואת החדשה.
        </p>

        <div>
          <label className="text-sm font-medium text-zinc-700">סיסמה נוכחית</label>
          <input
            className="field mt-1 w-full"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700">סיסמה חדשה</label>
          <input
            className="field mt-1 w-full"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700">אימות סיסמה חדשה</label>
          <input
            className="field mt-1 w-full"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-emerald-600 font-medium">הסיסמה עודכנה בהצלחה</p>}

      <button type="submit" disabled={saving} className="btn btn-primary w-full">
        {saving ? "שומר..." : "שמור סיסמה"}
      </button>
    </form>
  );
}
