import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import BudgetWizard from "./ui/BudgetWizard";
import PageHeader from "@/app/ui/PageHeader";

export default async function BudgetPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div>
      <LiveRefresh url="/api/stream/events?full=1" />
      <PageHeader
        title="תקציב"
        subtitle="כמה נכנס, כמה יוצא, בבהירות"
      />
      <BudgetWizard userId={user.id} />
    </div>
  );
}
