import Link from "next/link";

export const metadata = {
  title: "תנאי שימוש | Finance OCR",
  description: "תנאי השימוש במערכת Finance OCR",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">תנאי שימוש</h1>
        <p className="mt-1 text-sm text-zinc-600">עדכון אחרון: 2025</p>
      </div>

      <div className="card p-6 space-y-6 text-sm text-zinc-700">
        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">1. כלי עזר לניהול בלבד</h2>
          <p>
            המערכת נועדה לשמש ככלי עזר לניהול הכנסות, הוצאות ומסמכים פיננסיים בלבד. היא אינה מהווה ייעוץ מס, ייעוץ
            משפטי או חוות דעת רואה חשבון. <strong>האחריות על דיווח לרשויות המס, הגשת דוחות ורישום ספרים מוטלת על המשתמש ורואה החשבון שלו בלבד.</strong>
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">2. הגבלת אחריות (Limitation of Liability)</h2>
          <p>
            במידה המרבית המותרת על פי דין, מפעיל המערכת לא יהיה אחראי לכל נזק ישיר או עקיף, לרבות אובדן רווחים,
            אובדן נתונים, החלטות עסקיות שגויות או נזקים אחרים הנובעים משימוש או אי־שימוש במערכת. השימוש במערכת
            הוא על אחריות המשתמש הבלעדית.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">3. נתונים וגיבויים</h2>
          <p>
            המשתמש אחראי לשמירת עותקים של הנתונים החשובים לו. מומלץ להגדיר גיבויים אוטומטיים במסד הנתונים (לפי
            ההנחיות של ספק ה-DB). מפעיל המערכת לא יהיה אחראי לאובדן נתונים עקב תקלה, השבתה או שינוי בשירות.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">4. העלאה דרך וואטסאפ (Twilio / Meta)</h2>
          <p>
            העלאת קבלות דרך וואטסאפ עוברת דרך צד שלישי – Twilio ו־Meta (WhatsApp). השימוש
            בתכונה זו כפוף גם למדיניות הפרטיות ולתנאי השימוש של Twilio ושל Meta. מפעיל המערכת אינו שולט על אופן
            העברת הנתונים אצל צדדים אלה.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">5. קבלת התנאים</h2>
          <p>
            שימוש במערכת (הרשמה, התחברות, העלאה או ייצוא נתונים) מהווה הסכמה לתנאים אלה. אם אינך מסכים – אל
            תשתמש במערכת.
          </p>
        </section>
      </div>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/privacy" className="font-medium text-zinc-700 underline">
          מדיניות פרטיות
        </Link>
        {" · "}
        <Link href="/dashboard" className="font-medium text-zinc-700 underline">
          חזרה לדשבורד
        </Link>
      </p>
    </div>
  );
}
