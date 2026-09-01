import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import PasskeysClient from "./ui/PasskeysClient";

export const dynamic = "force-dynamic";

export default async function PasskeysPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <div className="section-header">
        <div>
          <h1 className="section-title">Passkeys</h1>
          <p className="section-sub">מכשירים עם Face ID / Touch ID שיכולים להתחבר לחשבון</p>
        </div>
      </div>
      <PasskeysClient />
    </div>
  );
}
