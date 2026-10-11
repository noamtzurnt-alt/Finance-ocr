import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import { Suspense } from "react";
import TransactionsContent from "./ui/TransactionsContent";
import PageHeader from "@/app/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div>
      <LiveRefresh />
      <PageHeader
        title="תנועות"
        subtitle="הכנסות והוצאות יחד, תזרים מזומנים"
      />

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="card p-5 sm:p-6">
              <div className="h-5 w-40 animate-pulse rounded bg-[var(--surface2)]" />
              <div className="overview-grid mt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="metric-tile h-20 animate-pulse bg-[var(--surface2)]" />
                ))}
              </div>
            </div>
            <div className="card p-5 sm:p-6">
              <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface2)]" />
            </div>
          </div>
        }
      >
        <TransactionsContent userId={user.id} />
      </Suspense>
    </div>
  );
}
