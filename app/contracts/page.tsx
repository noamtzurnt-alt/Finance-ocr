import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import PageHeader from "@/app/ui/PageHeader";
import { Suspense } from "react";
import ContractsContent from "./ui/ContractsContent";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div>
      <LiveRefresh />
      <PageHeader
        title="חוזים"
        subtitle="חוזי לקוחות לפי שם, כולל PDF חתום ועותק HTML של מייל החתימה"
      />

      <Suspense
        fallback={
          <div className="card p-4">
            <div className="h-5 w-56 animate-pulse rounded bg-[var(--surface2)]" />
            <div className="mt-4 h-72 animate-pulse rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]" />
          </div>
        }
      >
        <ContractsContent userId={user.id} />
      </Suspense>
    </div>
  );
}
