"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LiveRefresh from "@/app/ui/LiveRefresh";
import { parseReceiptText } from "@/app/lib/ocr/parse";

type Category = { id: string; name: string };

type DocData = {
  id: string;  type: "expense" | "income" | "payment_receipt";
  date: string;
  amount: string;
  vatAmount: string;
  preVatAmount: string;
  isRecognized: string;
  currency: string;
  vendor: string;
  categoryId: string | null;
  description: string | null;
  docNumber: string | null;
  fileName: string;
  fileKey: string;
  ocrStatus: string;
  ocrText: string | null;
  fileMime: string;
};

type EditorProps = {
  doc: DocData;
  categories: Category[];
  defaultBackHref: string;
  vatPercent: number;
};

export default function DocumentEditor({ doc, categories, defaultBackHref, vatPercent }: EditorProps) {
  const router = useRouter();
  const [form, setForm] = useState(doc);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const ocrParsed = useMemo(() => {
    if (!doc.ocrText) return null;
    try {
      return parseReceiptText(doc.ocrText);
    } catch {
      return null;
    }
  }, [doc.ocrText]);

  // Auto-calculate VAT logic
  const updateAmounts = (total: string) => {
    const t = parseFloat(total) || 0;
    const v = (t * (vatPercent / (100 + vatPercent))).toFixed(2);
    const p = (t - parseFloat(v)).toFixed(2);
    setForm((f) => ({ ...f, amount: total, vatAmount: v, preVatAmount: p }));
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Convert back to numbers for API
          amount: parseFloat(form.amount) || 0,
          vatAmount: parseFloat(form.vatAmount) || 0,
          preVatAmount: parseFloat(form.preVatAmount) || 0,
          isRecognized: parseFloat(form.isRecognized) || 100,
        }),
      });
      if (!res.ok) throw new Error("שמירה נכשלה");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("למחוק את המסמך לצמיתות?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("מחיקה נכשלה");
      router.replace(defaultBackHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <LiveRefresh />
      
      {/* Sidebar Editor */}
      <div className="space-y-6 order-2 lg:order-1">
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">פרטי {doc.type === "expense" ? "הוצאה" : "הכנסה"}</h2>
            <button
              onClick={remove}
              disabled={deleting || saving}
              className="text-xs text-red-600 hover:underline"
            >
              מחיקת מסמך
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">תאריך</label>
              <input
                type="date"
                className="field mt-1 w-full"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">מספר מסמך / אסמכתא</label>
              <input
                className="field mt-1 w-full"
                value={form.docNumber ?? ""}
                onChange={(e) => setForm({ ...form, docNumber: e.target.value })}
                placeholder="למשל: INV-0001 או 10234"
              />
              <p className="text-xs text-zinc-500 mt-1">מספר חשבונית או קבלה מהמסמך – ימולא אוטומטית אחרי סריקת OCR</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">{doc.type === "expense" ? "ספק" : "לקוח"}</label>
            <input
              className="field mt-1 w-full"
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            />
          </div>

          <div className="border-t border-zinc-100 pt-4 mt-4">
            <label className="text-sm font-medium text-emerald-700 font-bold">סה&quot;כ (₪)</label>
            <input
              type="number"
              step="0.01"
              className="field mt-1 w-full border-emerald-200 focus:ring-emerald-500/20"
              value={form.amount}
              onChange={(e) => updateAmounts(e.target.value)}
            />
            {ocrParsed?.currency === "USD" && ocrParsed.amount ? (
              <p className="text-xs text-zinc-500 mt-1">
                {Number.isFinite(Number(form.amount)) ? `${Number(form.amount).toFixed(2)} ₪` : `${form.amount} ₪`} ({ocrParsed.amount}$)
              </p>
            ) : null}
            <p className="text-xs text-zinc-500 mt-1">לפני מע״מ = סה״כ ÷ (1 + אחוז מע״מ/100). אחוז המע״מ בהגדרות (למשל 17% או 18%).</p>
          </div>

          <div>
            <label className="text-sm font-medium">תיאור / הערה</label>
            <textarea
              className="field mt-1 w-full h-20"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {savedSuccess && <p className="text-sm text-emerald-600 font-medium">נשמר בהצלחה</p>}
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          {doc.ocrStatus === "failed" && doc.ocrText ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <strong>OCR נכשל:</strong>{" "}
              {doc.ocrText.startsWith("OCR job failed:") ? doc.ocrText.slice("OCR job failed:".length).trim().slice(0, 400) : doc.ocrText.slice(0, 400)}
              {doc.ocrText.length > 400 ? "…" : ""}
            </div>
          ) : null}

          <button
            onClick={save}
            disabled={saving || deleting}
            className="btn btn-primary w-full py-3 text-base shadow-lg shadow-black/5 inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                שומר...
              </>
            ) : (
              "שמור וסיים"
            )}
          </button>
        </div>

        {doc.ocrText && (
          <div className="card p-4 bg-zinc-50/50">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">טקסט שחולץ (OCR)</h3>
            <pre className="text-[10px] text-zinc-600 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
              {doc.ocrText}
            </pre>
          </div>
        )}
      </div>

      {/* Preview Section */}
      <div className="order-1 lg:order-2">
        <div className="sticky top-6 rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-100 shadow-inner min-h-[600px] flex items-center justify-center">
          {previewFailed ? (
            <div className="text-center p-8 text-zinc-500 max-w-sm" dir="rtl">
              <p className="font-medium">אין תמונה זמינה למסמך זה</p>
              <p className="text-sm mt-1">ייתכן שהמסמך הועלה לפני מעבר לאחסון הנוכחי.</p>
            </div>
          ) : doc.fileMime === "application/pdf" ? (
            <iframe
              src={`/api/documents/${doc.id}/view`}
              className="w-full h-[800px]"
              title="PDF Preview"
            />
          ) : (
            <img
              src={`/api/documents/${doc.id}/view`}
              alt="Document Preview"
              className="max-w-full h-auto shadow-2xl"
              onError={() => setPreviewFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
