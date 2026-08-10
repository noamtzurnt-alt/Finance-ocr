import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import BudgetWizard from "./ui/BudgetWizard";

export default async function BudgetPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <LiveRefresh url="/api/stream/events?full=1" />
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-l from-violet-600 via-indigo-600 to-teal-600 px-5 py-4 text-white shadow-lg shadow-violet-200/40">
        <div className="pointer-events-none absolute -left-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
        <div className="relative">
          <h1 className="text-xl font-bold tracking-tight">💰 תקציב</h1>
          <p className="mt-1 text-sm text-white/85">כמה נכנס, כמה יוצא — בצבע ובבהירות</p>
        </div>
      </div>

      <BudgetWizard />
    </div>
  );
}



