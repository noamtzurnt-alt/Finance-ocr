import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import SettingsClient from "./ui/SettingsClient";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      businessType: true,
      businessName: true,
      taxId: true,
      vatPercent: true,
      phoneNumber: true,
      whatsappIncomingNumber: true,
      isAdmin: true,
    },
  });

  if (!dbUser) redirect("/login");

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">הגדרות עסק</h1>
          <p className="section-sub">סוג עסק, מע״מ ופרטי התקשרות</p>
        </div>
      </div>

      <div className="card p-6">
        <SettingsClient
          initial={{
            businessType: dbUser.businessType,
            businessName: dbUser.businessName ?? "",
            taxId: dbUser.taxId ?? "",
            vatPercent: dbUser.vatPercent.toString(),
            phoneNumber: dbUser.phoneNumber ?? "",
            whatsappIncomingNumber: dbUser.whatsappIncomingNumber ?? "",
          }}
        />
      </div>

      <div className="card p-4">
        <h2 className="text-lg font-medium text-zinc-900">WhatsApp ל-Production</h2>
        <p className="mt-1 text-sm text-zinc-600">
          כדי שלקוחות יוכלו לשלוח קבלות למספר משלך בלי Sandbox ו-&quot;join&quot; – צריך לחבר Meta Business, WhatsApp Business Account ו-Twilio.
        </p>
        <Link href="/settings/whatsapp-setup" className="btn btn-primary mt-3">
          מדריך הגדרת WhatsApp ל-Production
        </Link>
      </div>

      <div className="card p-4">
        <h2 className="text-lg font-medium text-zinc-900">כניסה עם Face ID / Touch ID</h2>
        <p className="mt-1 text-sm text-zinc-600">
          ניתן להוסיף כניסה מהירה עם Face ID (טלפון) או Touch ID (מחשב) בעמוד אוצר סיסמאות.
        </p>
        <Link href="/credentials" className="btn btn-primary mt-3">
          אוצר סיסמאות ו־Passkeys
        </Link>
      </div>

      {dbUser.isAdmin ? (
        <div className="card p-4">
          <h2 className="text-lg font-medium text-zinc-900">ניהול משתמשים</h2>
          <p className="mt-1 text-sm text-zinc-600">
            אשר הרשמות חדשות או צור משתמשים ידנית — אימייל, סיסמה ומספר טלפון. קבלות שיישלחו ממספר הטלפון יישמרו בחשבון של אותו משתמש.
          </p>
          <Link href="/admin/users" className="btn btn-primary mt-3">
            ניהול משתמשים
          </Link>
        </div>
      ) : null}
    </div>
  );
}
