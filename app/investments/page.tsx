import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import Link from "next/link";
import { Suspense } from "react";
import InvestmentsContent from "./ui/InvestmentsContent";

export default async function InvestmentsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <LiveRefresh url="/api/stream/events?full=1" />
      <div className="section-header">
        <div>
          <h1 className="section-title">השקעות</h1>
          <p className="section-sub">ריכוז הפקדות/משיכות לפי שנה</p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="card p-4">
              <div className="h-5 w-72 animate-pulse rounded bg-zinc-200" />
              <div className="mt-3 h-20 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
            </div>
            <div className="h-80 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
          </div>
        }
      >
        <InvestmentsContent userId={user.id} />
      </Suspense>
    </div>
  );
}

