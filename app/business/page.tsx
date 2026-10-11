import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import BusinessHub from "./ui/BusinessHub";
import PageHeader from "@/app/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div>
      <LiveRefresh />
      <PageHeader
        title="עסקי"
        subtitle="חוזים, מסמכים וייצוא – הכל במקום אחד"
      />
      <BusinessHub />
    </div>
  );
}
