import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LogoutButton from "./ui/LogoutButton";
import LiveRefresh from "@/app/ui/LiveRefresh";
import { Suspense } from "react";
import DashboardContent from "./ui/DashboardContent";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const now = new Date();

  const todayLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{todayLabel}</h1>
          <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <LogoutButton />
        </div>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
              ))}
            </div>
            <div className="h-72 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
          </div>
        }
      >
        <DashboardContent userId={user.id} now={now} />
      </Suspense>
    </div>
  );
}


