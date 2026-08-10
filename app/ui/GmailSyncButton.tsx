"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncPurpose = "contracts" | "receipts";

type SyncResult = {
  scanned?: number;
  imported?: number;
  skipped?: number;
  errors?: number;
};

export default function GmailSyncButton(props: {
  purpose: SyncPurpose;
  label?: string;
  className?: string;
  onDone?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/gmail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: props.purpose }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        results?: SyncResult[];
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "הסנכרון נכשל");
        return;
      }

      const result = data?.results?.[0];
      const imported = result?.imported ?? 0;
      const scanned = result?.scanned ?? 0;
      const skipped = result?.skipped ?? 0;
      const noun = props.purpose === "contracts" ? "חוזים" : "קבלות";
      setMsg(
        imported > 0
          ? `נקלטו ${imported} ${noun} חדשים (נסרקו ${scanned})`
          : scanned > 0
            ? `אין חדשים — נסרקו ${scanned}, דולגו ${skipped}`
            : "אין מיילים חדשים לסנכרון",
      );

      if (props.onDone) await props.onDone();
      else router.refresh();
    } catch {
      setError("הסנכרון נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={props.className ?? "btn btn-primary text-sm"}
        disabled={busy}
        onClick={() => void sync()}
      >
        {busy
          ? "מסנכרן..."
          : props.label ?? (props.purpose === "contracts" ? "סנכרן חוזים מהמייל" : "סנכרן קבלות מהמייל")}
      </button>
      {msg ? <p className="text-xs text-emerald-700">{msg}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
