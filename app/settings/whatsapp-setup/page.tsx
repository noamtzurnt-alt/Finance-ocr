import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/app/lib/auth/server";

export default async function WhatsAppSetupPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/settings" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← חזרה להגדרות
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mt-2">
          WhatsApp ב-Production – מספר משלך
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          ב-Sandbox רק מי ששולח &quot;join&quot; יכול לשלוח. ב-Production יש לך מספר WhatsApp Business משלך ולקוחות יכולים לשלוח אליו ישירות.
        </p>
      </div>

      <div className="card p-6 space-y-6 text-sm text-zinc-700">
        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">מה צריך</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>חשבון <strong>Meta Business</strong> (עסק מאומת)</li>
            <li><strong>WhatsApp Business Account (WABA)</strong> – מחובר ל-Meta</li>
            <li>מספר טלפון ייעודי ל-WhatsApp העסקי</li>
            <li><strong>Twilio</strong> כ-BSP שמחבר את המספר ל-API ומעביר הודעות ל-Webhook שלנו</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900 mb-2">צעדים (בקצרה)</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>Meta Business:</strong> היכנס ל־business.facebook.com, צור/התחבר לחשבון עסקי, אמת את העסק אם נדרש.
            </li>
            <li>
              <strong>WhatsApp Business:</strong> ב-Meta Business Suite → הוסף WhatsApp → צור WhatsApp Business Account (WABA).
            </li>
            <li>
              <strong>מספר:</strong> צריך מספר ייעודי ל-WhatsApp Business (חדש או העברה מתאימה).
            </li>
            <li>
              <strong>Twilio:</strong> ב-Console → Messaging → WhatsApp → Senders. חבר את המספר ל-WhatsApp דרך Twilio (חיבור ל-WABA ואישור Meta).
            </li>
            <li>
              <strong>Webhook:</strong> בהגדרות המספר ב-Twilio – Webhook URL = <code className="bg-zinc-100 px-1 rounded">https://הדומיין-שלך.com/api/webhooks/incoming</code>
            </li>
            <li>
              <strong>באתר:</strong> בהגדרות עסק → &quot;מספר WhatsApp לקבלת קבלות&quot; הזן את המספר של Twilio (פורמט: 972501234567).
            </li>
          </ol>
        </section>

        <section className="pt-2 border-t border-zinc-200">
          <p className="text-zinc-600">
            אחרי שהכל מוגדר, לקוחות שולחים למספר העסקי בלי &quot;join&quot; – ההודעות מגיעות ל-Webhook והמערכת מטפלת בהן אוטומטית.
          </p>
        </section>
      </div>

      <Link href="/settings" className="btn">
        חזרה להגדרות
      </Link>
    </div>
  );
}
