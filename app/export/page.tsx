import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import ExportClient from "./ui/ExportClient";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function ExportPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const year = new Date().getFullYear();

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">ייצוא לרו״ח</h1>
          <p className="section-sub">הורד XLSX או ZIP לפי חודשים לשליחה לרואה חשבון</p>
        </div>
      </div>

      <div
        className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900"
        role="alert"
      >
        <strong>הבהרה:</strong> המערכת היא כלי עזר לניהול בלבד ואינה תחליף לייעוץ מס או רואה חשבון.
        האחריות על דיווח לרשויות המס, הגשת דוחות ורישום ספרים מוטלת עליך ורואה החשבון שלך בלבד.{" "}
        <Link href="/terms" className="font-medium underline hover:no-underline">
          תנאי שימוש
        </Link>
        .
      </div>

      <div className="card p-4">
        <ExportClient defaultYear={year} />
      </div>
    </div>
  );
}


