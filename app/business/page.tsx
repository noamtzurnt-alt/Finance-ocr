import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import BusinessHub from "./ui/BusinessHub";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="section-header">
        <div>
          <h1 className="section-title">עסקי</h1>
          <p className="section-sub">חוזים, מסמכים וייצוא – הכל במקום אחד</p>
        </div>
      </div>

      <BusinessHub />
    </div>
  );
}
