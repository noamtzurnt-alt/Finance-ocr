import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { normalizeAppTheme } from "@/app/lib/ui/theme";
import { getObjectReadUrl } from "@/app/lib/r2/objects";
import { getBudgetCycle, normalizeCycleStartDay } from "@/app/lib/budget/cycle";
import PasskeysClient from "./ui/PasskeysClient";
import ThemePicker from "./ui/ThemePicker";
import LogoPicker from "./ui/LogoPicker";
import BudgetCyclePicker from "./ui/BudgetCyclePicker";
import PageHeader from "@/app/ui/PageHeader";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function PasskeysPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { theme: true, logoKey: true, budgetCycleStartDay: true },
  });

  let logoUrl: string | null = null;
  if (row?.logoKey) {
    try {
      logoUrl = await getObjectReadUrl(row.logoKey, 60 * 60);
    } catch {
      logoUrl = null;
    }
  }

  const cycleStartDay = normalizeCycleStartDay(row?.budgetCycleStartDay ?? 1);

  return (
    <div>
      <PageHeader
        title="הגדרות"
        subtitle="צבעים, לוגו, מכשירים ו־Face ID"
      />
      <div className="space-y-4">
        <ThemePicker initialTheme={normalizeAppTheme(row?.theme)} />
        <BudgetCyclePicker
          initialStartDay={cycleStartDay}
          initialLabel={getBudgetCycle(new Date(), cycleStartDay).label}
        />
        <LogoPicker initialLogoUrl={logoUrl} enabled />
        <Suspense fallback={<div className="card p-4 text-sm" style={{ color: "var(--muted)" }}>טוען…</div>}>
          <PasskeysClient />
        </Suspense>
      </div>
    </div>
  );
}
