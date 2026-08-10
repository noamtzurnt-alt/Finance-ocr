import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/lib/auth/server";
import Link from "next/link";
import CreateUserForm from "./ui/CreateUserForm";
import PendingApprovalList from "./ui/PendingApprovalList";
import ActiveUsersList from "./ui/ActiveUsersList";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">ניהול משתמשים</h1>
        <p className="mt-1 text-sm text-zinc-600">
          אשר הרשמות חדשות, או צור משתמש ידנית — אימייל, סיסמה ומספר טלפון. הקבלות שיישלחו ממספר הטלפון יישמרו בחשבון של אותו משתמש.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-zinc-900 mb-3">משתמשים פעילים</h2>
        <p className="text-sm text-zinc-600 mb-4">כל מי שאושר ויכול להתחבר. לחיצה על &quot;מחק&quot; מוחקת את המשתמש ואת כל הנתונים שלו לצמיתות.</p>
        <ActiveUsersList />
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-zinc-900 mb-3">ממתינים לאישור</h2>
        <p className="text-sm text-zinc-600 mb-4">מי שנרשם דרך דף ההרשמה – אחרי לחיצה על &quot;אישור&quot; הוא יוכל להתחבר.</p>
        <PendingApprovalList />
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-zinc-900 mb-3">צור משתמש ידנית</h2>
        <CreateUserForm />
      </div>
    </div>
  );
}
