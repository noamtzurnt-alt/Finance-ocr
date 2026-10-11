import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { loadReminders } from "@/app/lib/reminders/server";
import RemindersClient from "./ui/RemindersClient";
import "./reminders.css";

export const dynamic = "force-dynamic";

export default async function RemindersPage(props: { searchParams: Promise<{ r?: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const [initial, { r }] = await Promise.all([loadReminders(user.id), props.searchParams]);

  return (
    <div className="rem-page">
      <RemindersClient initial={initial} openId={typeof r === "string" ? r : null} />
    </div>
  );
}
