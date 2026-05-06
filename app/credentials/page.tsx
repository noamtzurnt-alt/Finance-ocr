import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import PasskeysCard from "./ui/PasskeysCard";
import Link from "next/link";
import { Suspense } from "react";
import CredentialsContent from "./ui/CredentialsContent";

export default async function CredentialsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <LiveRefresh url="/api/stream/events?full=1" />
      <div className="section-header">
        <div>
          <h1 className="section-title">סיסמאות</h1>
          <p className="section-sub">כספת אישית מוצפנת לשמירת פרטי התחברות</p>
        </div>
      </div>

      <PasskeysCard />

      <Suspense
        fallback={
          <div className="card p-4">
            <div className="h-5 w-56 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-72 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
          </div>
        }
      >
        <CredentialsContent userId={user.id} />
      </Suspense>
    </div>
  );
}


