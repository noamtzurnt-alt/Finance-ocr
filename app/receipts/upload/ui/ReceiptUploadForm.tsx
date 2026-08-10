"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptFile = useMemo(() => "image/*,application/pdf", []);
  const acceptCamera = useMemo(() => "image/*", []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const phoneFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = useCallback((selectedFile: File | null) => {
    setFile(selectedFile);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("נא לבחור קובץ");
      return;
    }
    const v = vendor.trim();
    if (!v) {
      setError("שם בית העסק חובה");
      return;
    }
    if (!date) {
      setError("תאריך חובה");
      return;
    }
    const a = parseFloat(amount);
    if (!amount.trim() || Number.isNaN(a) || a <= 0) {
      setError("סכום כסף חובה (מעל 0)");
      return;
    }
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append(
      "meta",
      JSON.stringify({
        type: "expense",
        vendor: v,
        date,
        amount: String(a),
        description: description.trim() || null,
      }),
    );

    const res = await fetch("/api/documents/upload", { method: "POST", body: form });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string; docId?: string } | null;
      if (res.status === 409 && body?.docId) {
        router.replace(`/documents/${body.docId}?from=receipts`);
        return;
      }
      setError(body?.error ?? "שגיאת העלאה");
      return;
    }
    const body = (await res.json()) as { id: string };
    router.replace(`/documents/${body.id}?from=receipts`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">קובץ</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
            העלאה מהמחשב
          </button>
          <button type="button" className="btn" onClick={() => phoneFileInputRef.current?.click()}>
            העלאה מהטלפון (קובץ)
          </button>
          <button type="button" className="btn btn-primary" onClick={() => cameraInputRef.current?.click()}>
            העלאה מהטלפון (מצלמה)
          </button>
        </div>
        <div className="mt-2 text-xs text-zinc-600">
          {file ? `נבחר: ${file.name}` : "לא נבחר קובץ"}
        </div>

        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept={acceptFile}
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <input
          ref={phoneFileInputRef}
          className="hidden"
          type="file"
          accept={acceptFile}
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraInputRef}
          className="hidden"
          type="file"
          accept={acceptCamera}
          capture="environment"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">שם בית העסק <span className="text-red-500">*</span></label>
          <input className="field mt-1" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="למשל: סופר פארם" required />
        </div>
        <div>
          <label className="text-sm font-medium">תאריך <span className="text-red-500">*</span></label>
          <input className="field mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">סכום (₪) <span className="text-red-500">*</span></label>
          <input className="field mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="למשל 89.90" required />
        </div>
        <div>
          <label className="text-sm font-medium">תיאור (אופציונלי)</label>
          <input className="field mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='למשל: "מצלמה לעסק"' />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button disabled={!file || !vendor.trim() || !date || !amount.trim() || loading} className="btn btn-primary disabled:opacity-60 inline-flex items-center justify-center gap-2 min-w-[8rem]" type="submit">
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
            מעלה...
          </>
        ) : (
          "העלה"
        )}
      </button>
    </form>
  );
}
