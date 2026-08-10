import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  redirect("/dashboard");
}

