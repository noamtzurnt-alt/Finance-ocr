import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import SetupForm from "./ui/SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const users = await prisma.user.count();
  if (users > 0) redirect("/login");

  return (
    <div className="auth-page flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>הגדרה ראשונית</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          יצירת משתמש יחיד למערכת (רק אתה).
        </p>
        <div className="mt-6">
          <SetupForm />
        </div>
      </div>
    </div>
  );
}


