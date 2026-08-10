import Link from "next/link";

export const metadata = {
  title: "מדיניות פרטיות | Finance OCR",
  description: "מדיניות הפרטיות של Finance OCR",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">מדיניות פרטיות</h1>
        <p className="mt-1 text-sm text-zinc-600">עדכון אחרון: 2025</p>
      </div>

      <div className="card p-6 space-y-6 text-sm text-zinc-700">
        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">1. איזה מידע נשמר</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>נתוני חשבון: אימייל, סיסמה (מוצפנת), מספר טלפון (אם הוזן).</li>
            <li>מסמכים: קבצי קבלות שהעלית או שנשלחו אליך (תמונות/PDF), יחד עם פרטים שמילאת (סכום, תאריך, ספק וכו׳).</li>
            <li>תנועות כסף, תקציב, קטגוריות, השקעות (אם השתמשת).</li>
            <li>אוצר סיסמאות: סיסמאות שאתה שומר – נשמרות מוצפנות (AES-256-GCM). מפעיל המערכת לא יכול לראותן.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">2. איך המידע מאובטח</h2>
          <p>
            סיסמאות המשתמש וסיסמאות באוצר הסיסמאות מוצפנות. גישה לנתונים מתבצעת רק לאחר התחברות. הנתונים
            ממוקמים לפי משתמש (Multitenancy) – משתמש א׳ לא יכול לראות נתונים של משתמש ב׳.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">3. שיתוף עם צד שלישי</h2>
          <p>
            הנתונים שלך לא נמכרים לצד שלישי. שירותים חיצוניים (אירוח, DB, אחסון קבצים) עשויים לאחסן או
            לעבד נתונים לפי מדיניותם – מומלץ לעיין בהנחיות הספק (למשל Vercel, Supabase/Neon, Cloudflare R2).
          </p>
          <p>
            <strong>העלאה דרך וואטסאפ:</strong> מסמכים ששולחים דרך וואטסאפ עוברים דרך Twilio ו־Meta (WhatsApp).
            העברת המידע כפופה למדיניות הפרטיות ולתנאי השימוש של Twilio ושל Meta – מומלץ לעיין בהן לפני שימוש
            בתכונה.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">4. רישום מאגרי מידע</h2>
          <p>
            אם נשמר מידע רגיש על רבים ומתקיימות חובות לפי חוק הגנת הפרטיות, ייתכן שיחולו דרישות לרישום מאגר
            מידע. יש להתייעץ עם עורך דין או רשם מאגרי מידע.
          </p>
        </section>
      </div>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/terms" className="font-medium text-zinc-700 underline">
          תנאי שימוש
        </Link>
        {" · "}
        <Link href="/dashboard" className="font-medium text-zinc-700 underline">
          חזרה לדשבורד
        </Link>
      </p>
    </div>
  );
}
