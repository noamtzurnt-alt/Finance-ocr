import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/app/lib/prisma";
import LoginForm from "./ui/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.count();
  if (users === 0) redirect("/setup");

  return (
    <div className="auth-page flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>התחברות</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>התחברות עם Face ID / Touch ID בלבד.</p>
        <div className="mt-6">
          <Suspense fallback={<div className="text-sm" style={{ color: "var(--muted)" }}>טוען…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
