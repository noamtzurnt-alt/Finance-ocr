import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import { Suspense } from "react";
import ContractsContent from "./ui/ContractsContent";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">חוזים</h1>
          <p className="section-sub">
            חוזי לקוחות לפי שם — כולל PDF חתום ועותק HTML של מייל החתימה
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="card p-4">
            <div className="h-5 w-56 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-72 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
          </div>
        }
      >
        <ContractsContent userId={user.id} />
      </Suspense>
    </div>
  );
}
