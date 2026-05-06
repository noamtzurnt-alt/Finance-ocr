"use client";

import { useEffect, useState } from "react";

type Transaction = {
  id: string;
  date: string;
  amount: string;
  vendor: string;
  description: string | null;
};

const FEE_KEYWORDS = [
  "עמלה", "עמלות", "דמי ניהול", "דמי כרטיס", "ניהול חשבון",
  "עמלת העברה", "עמלת משיכה", "דמי חבר", "דמי מנהל", "עמלת פירעון",
  "עמלת הקמה", "עמלת פתיחה", "עמלת סגירה", "עמלת המרה",
  "fee", "commission", "charge", "maintenance",
];

function detectFees(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => {
    const text = `${t.vendor} ${t.description ?? ""}`.toLowerCase();
    return FEE_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
  });
}

function generateWhatsAppScript(fees: Transaction[], totalFees: number): string {
  const feeList = fees
    .slice(0, 5)
    .map((f) => `• ${f.date}: ${f.vendor} — ${f.amount} ₪`)
    .join("\n");

  return `שלום,
אני לקוח שמנתח את הוצאותיו.
זיהיתי עמלות בחשבוני בסכום כולל של ${totalFees.toFixed(2)} ₪ ב-6 חודשים האחרונים:

${feeList}

אבקש לבטל או להחזיר את העמלות הנ"ל לאור נאמנותי כלקוח.
אשמח לדון בכך.
תודה,`;
}

export default function BankFeeDetector() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<Transaction[]>([]);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Fetch last 6 months of transactions
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    fetch(`/api/transactions?limit=200&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data: Transaction[]) => {
        setTransactions(data);
        setFees(detectFees(data));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalFees = fees.reduce((sum, f) => sum + Number(f.amount), 0);
  const script = fees.length > 0 ? generateWhatsAppScript(fees, totalFees) : "";

  async function copyScript() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          סורק עמלות בנק...
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <span className="text-sm">🏦</span>
            </div>
            <span className="font-semibold text-zinc-900">גלאי עמלות בנק</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">סורק תנועות ומזהה עמלות שניתן לבטל</p>
        </div>
        {fees.length > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
            {fees.length} עמלות · {totalFees.toFixed(0)} ₪
          </span>
        )}
      </div>

      <div className="p-5">
        {fees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="text-3xl">✅</div>
            <div className="font-semibold text-zinc-700">לא נמצאו עמלות בנק בתנועות החודש</div>
            <p className="text-xs text-zinc-400">
              בדקנו {transactions.length} תנועות ולא זיהינו עמלות. לבדיקה מלאה — ייצא תנועות בדף הייצוא.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-semibold text-red-800">
                זיהינו {fees.length} עמלות בנק בסך {totalFees.toFixed(2)} ₪
              </div>
              <p className="mt-1 text-xs text-red-600">
                עמלות רבות ניתנות לביטול בשיחה פשוטה עם הבנקאי שלך
              </p>
            </div>

            {/* Fee list */}
            <div>
              <button type="button" onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900">
                <svg viewBox="0 0 16 16" className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 3l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {expanded ? "הסתר" : "הצג"} עמלות שנמצאו
              </button>
              {expanded && (
                <div className="mt-2 space-y-1.5">
                  {fees.map((f) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-zinc-900">{f.vendor}</span>
                        {f.description && <span className="mr-1 text-zinc-500">— {f.description}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400">{f.date}</span>
                        <span className="font-semibold text-red-600">{f.amount} ₪</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WhatsApp script */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">💬</span>
                <span className="text-sm font-semibold text-zinc-900">תסריט שיחה לבנקאי</span>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700 leading-relaxed">
                {script}
              </pre>
              <button type="button" onClick={copyScript}
                className={`mt-3 btn w-full text-sm ${copied ? "btn-primary" : ""}`}>
                {copied ? "✓ הועתק ללוח!" : "📋 העתק לשיחת WhatsApp עם הבנקאי"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
