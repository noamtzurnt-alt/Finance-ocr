import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import SetupForm from "./ui/SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const users = await prisma.user.count();
  if (users > 0) redirect("/login");

  return (
    <div className="auth-page flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-950">הגדרה ראשונית</h1>
        <p className="mt-1 text-sm text-zinc-600">
          יצירת משתמש יחיד למערכת (רק אתה).
        </p>
        <div className="mt-6">
          <SetupForm />
        </div>
      </div>
    </div>
  );
}


