import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/app/lib/prisma";
import LoginForm from "./ui/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.count();
  if (users === 0) redirect("/setup");

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-950">התחברות</h1>
        <p className="mt-1 text-sm text-zinc-600">פותח Face ID אוטומטית — או התחבר עם סיסמה.</p>
        <div className="mt-6">
          <Suspense fallback={<div className="text-sm text-zinc-500">טוען…</div>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-sm text-zinc-600">
          <Link href="/forgot-password" className="font-medium text-zinc-900 underline">
            שכחתי סיסמה
          </Link>
          {" · "}
          <Link href="/signup" className="font-medium text-zinc-900 underline">
            הרשמה
          </Link>
        </p>
      </div>
    </div>
  );
}


