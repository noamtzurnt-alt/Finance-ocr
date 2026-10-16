import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/app/lib/prisma";
import { chatLabelForEmail, displayNameForEmail, isAllowedAccountEmail } from "@/app/lib/auth/accounts";
import LoginForm from "./ui/LoginForm";
import BrandLogo from "@/app/ui/BrandLogo";
import { createSignedChallenge } from "@/app/lib/auth/passkey-challenge";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const accounts = await prisma.user.findMany({
    select: { email: true },
    orderBy: { email: "asc" },
  });
  if (accounts.length === 0) redirect("/setup");
  const loginAccounts = accounts
    .map((row) => row.email)
    .filter(isAllowedAccountEmail)
    .map((email) => ({
      email,
      name: displayNameForEmail(email),
      chatLabel: chatLabelForEmail(email),
    }));
  const secret = process.env.AUTH_SECRET;
  const challenge = secret ? createSignedChallenge(secret) : null;

  return (
    <div className="auth-page flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandLogo />
          <span className="sidebar-logo-word">Noam</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>התחברות</h1>
        <div className="mt-6">
          <Suspense fallback={<div className="text-sm" style={{ color: "var(--muted)" }}>טוען…</div>}>
            <LoginForm accounts={loginAccounts} challenge={challenge} />
          </Suspense>
        </div>
        <p className="mt-5 text-center text-sm" style={{ color: "var(--muted)" }}>
          משתמש חדש?{" "}
          <Link href="/setup" className="font-semibold" style={{ color: "var(--brand)" }}>
            יצירת חשבון
          </Link>
        </p>
      </div>
    </div>
  );
}
