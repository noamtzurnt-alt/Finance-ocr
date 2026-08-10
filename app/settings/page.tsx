import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import SettingsClient from "./ui/SettingsClient";
import PasskeysCard from "./ui/PasskeysCard";
import MorningIntegrationCard from "./ui/MorningIntegrationCard";
import GmailIntegrationCard from "./ui/GmailIntegrationCard";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });

  if (!dbUser) redirect("/login");

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">הגדרות</h1>
          <p className="section-sub">פרטי החשבון שלך</p>
        </div>
      </div>

      <div className="card p-6">
        <SettingsClient email={dbUser.email} />
      </div>

      <MorningIntegrationCard />

      <GmailIntegrationCard />

      <PasskeysCard />
    </div>
  );
}
