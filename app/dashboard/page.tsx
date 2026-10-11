import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import PageHeader from "@/app/ui/PageHeader";
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

  return (
    <div>
      <LiveRefresh />
      <PageHeader
        title="דשבורד"
        subtitle="סקירה פיננסית"
      />
      <DashboardContent initialSummary={summary} initialCategoryBudgets={categoryBudgets} />
    </div>
  );
}
