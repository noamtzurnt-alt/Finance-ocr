import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LogoutButton from "./ui/LogoutButton";
import LiveRefresh from "@/app/ui/LiveRefresh";
import DashboardContent from "./ui/DashboardContent";
import { getDashboardSummary } from "@/app/lib/dashboard/summary";
import { getCategoryBudgets } from "@/app/lib/dashboard/category-budgets";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const [summary, categoryBudgets] = await Promise.all([
    getDashboardSummary(user.id),
    getCategoryBudgets(user.id),
  ]);

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
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            prefetch
            className="btn inline-flex items-center gap-2 border-transparent text-white hover:opacity-90"
            style={{ background: "var(--sidebar-bg)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/noam-finance-bot.webp" alt="" className="h-6 w-6 rounded-full object-cover" />
            Noam Finance
          </Link>
          <LogoutButton />
        </div>
      </div>
      <DashboardContent initialSummary={summary} initialCategoryBudgets={categoryBudgets} />
    </div>
  );
}
