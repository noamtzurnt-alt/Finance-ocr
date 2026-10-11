import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import ExportClient from "./ui/ExportClient";
import LiveRefresh from "@/app/ui/LiveRefresh";
import PageHeader from "@/app/ui/PageHeader";

export default async function ExportPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const year = new Date().getFullYear();

  return (
    <div>
      <LiveRefresh />
      <PageHeader
        title="ייצוא לרו״ח"
        subtitle="לכל שנה: מסמך הוצאות מוכרות + מסמך קבלות הכנסות"
      />

      <div
        className="card mb-5 px-4 py-3 text-sm"
        role="alert"
        style={{ color: "var(--muted)" }}
      >
        <strong style={{ color: "var(--foreground)" }}>הבהרה:</strong> המערכת היא כלי עזר לניהול בלבד ואינה תחליף לייעוץ מס או רואה חשבון.
        האחריות על דיווח לרשויות המס, הגשת דוחות ורישום ספרים מוטלת עליך ורואה החשבון שלך בלבד.
      </div>

      <div className="card p-4">
        <ExportClient defaultYear={year} />
      </div>
    </div>
  );
}


