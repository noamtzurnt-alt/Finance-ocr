import DashboardCards from "./DashboardCards";
import type { DashboardSummary } from "@/app/lib/dashboard/summary";

export default function DashboardContent(props: {
  initialSummary: DashboardSummary;
  initialCategoryBudgets: Record<string, number>;
}) {
  return (
    <DashboardCards
      initialSummary={props.initialSummary}
      initialCategoryBudgets={props.initialCategoryBudgets}
    />
  );
}
