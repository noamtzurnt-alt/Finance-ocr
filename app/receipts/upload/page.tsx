import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";

export default async function ReceiptUploadPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  redirect("/receipts");
}
