import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import PaymentReceiptUploadForm from "./ui/PaymentReceiptUploadForm";

export default async function PaymentReceiptUploadPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">קבלה חדשה (הכנסה)</h1>
          <p className="mt-1 text-sm text-zinc-600">העלה קבלה שהוצאת ללקוח לאחר ששילם (תמונה/‏PDF).</p>
        </div>
        <div className="flex items-center gap-2">
          <a className="btn" href="/payment-receipts">
            חזרה לקבלות (הכנסות)
          </a>
          <a className="btn" href="/dashboard">
            דשבורד
          </a>
        </div>
      </div>

      <div className="card p-4">
        <PaymentReceiptUploadForm categories={categories} />
      </div>
    </div>
  );
}
