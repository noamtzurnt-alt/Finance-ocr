import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/app/lib/prisma";
import LoginForm from "./ui/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.count();
  if (users === 0) redirect("/setup");

  return (
    <div className="auth-page flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-950">התחברות</h1>
        <p className="mt-1 text-sm text-zinc-600">התחברות עם Face ID / Touch ID בלבד.</p>
        <div className="mt-6">
          <Suspense fallback={<div className="text-sm text-zinc-500">טוען…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
