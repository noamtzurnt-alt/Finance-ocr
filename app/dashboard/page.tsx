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
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">{todayLabel}</h1>
          <p className="section-sub">{user.email}</p>
        </div>
        <LogoutButton />
      </div>
      <DashboardContent />
    </div>
  );
}


