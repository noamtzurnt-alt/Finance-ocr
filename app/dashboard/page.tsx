import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LogoutButton from "./ui/LogoutButton";
import LiveRefresh from "@/app/ui/LiveRefresh";
import DashboardContent from "./ui/DashboardContent";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const todayLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

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

      {/* DashboardContent is a client component — fetches data after page load, no DB wait */}
      <DashboardContent />
    </div>
  );
}


