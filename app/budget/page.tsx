import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import { Suspense } from "react";
import BudgetContent from "./ui/BudgetContent";
import BudgetWizard from "./ui/BudgetWizard";
import BankFeeDetector from "./ui/BankFeeDetector";

export default async function BudgetPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <LiveRefresh url="/api/stream/events?full=1" />
      <div className="section-header">
        <div>
          <h1 className="section-title">תקציב</h1>
          <p className="section-sub">ניהול תקציב, צ׳ק-אפ פיננסי וזיהוי עמלות</p>
        </div>
      </div>

      {/* Current budget tracker */}
      <Suspense
        fallback={
          <div className="card p-4">
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-40 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
          </div>
        }
      >
        <BudgetContent userId={user.id} />
      </Suspense>

      {/* Deep financial check-up wizard */}
      <BudgetWizard />

      {/* Bank fee detector */}
      <BankFeeDetector />
    </div>
  );
}
