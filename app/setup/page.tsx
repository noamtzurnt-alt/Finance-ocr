import { redirect } from "next/navigation";
import Link from "next/link";
import SetupForm from "./ui/SetupForm";
import BrandLogo from "@/app/ui/BrandLogo";
import { getSession } from "@/app/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const session = await getSession();
  if (session?.sub) redirect("/dashboard");

  const inviteRequired = Boolean(process.env.ACCOUNT_INVITE_CODE?.trim());

  return (
    <div className="auth-page flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandLogo />
          <span className="sidebar-logo-word">Noam</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>יצירת חשבון</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          יצירת חשבון ל־Noam או Meitar בלבד. כל אחד רואה רק את הנתונים שלו.
        </p>
        <div className="mt-6">
          <SetupForm inviteRequired={inviteRequired} />
        </div>
        <p className="mt-5 text-center text-sm" style={{ color: "var(--muted)" }}>
          כבר יש חשבון?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "var(--brand)" }}>
            התחברות
          </Link>
        </p>
      </div>
    </div>
  );
}
