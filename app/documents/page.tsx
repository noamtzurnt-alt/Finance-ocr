import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import DocumentsClient from "./ui/DocumentsClient";

export default async function DocumentsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Default: last 90 days, 50 docs
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 90);

  const docs = await prisma.document.findMany({
    where: {
      userId: user.id,
      type: { in: ["expense", "payment_receipt"] },
      date: { gte: from, lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      type: true,
      date: true,
      amount: true,
      currency: true,
      vendor: true,
      docNumber: true,
      category: { select: { id: true, name: true } },
      fileName: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">מסמכים</h1>
          <p className="mt-1 text-sm text-zinc-600">חיפוש, פילטרים וניהול כל המסמכים במקום אחד.</p>
        </div>
        <div className="flex items-center gap-2">
          <a className="btn" href="/upload">
            העלאה
          </a>
          <a className="btn" href="/dashboard">
            דשבורד
          </a>
        </div>
      </div>

      <div className="card p-4">
        <DocumentsClient
          categories={categories}
          initial={{
            items: docs.map((d) => ({
              id: d.id,
              type: d.type === "expense" ? "expense" as const : "payment_receipt" as const,
              date: d.date.toISOString().slice(0, 10),
              amount: d.amount.toString(),
              currency: d.currency,
              vendor: d.vendor,
              docNumber: d.docNumber,
              categoryId: d.category?.id ?? null,
              categoryName: d.category?.name ?? null,
              fileName: d.fileName,
            })),
            nextCursor: docs.length === 50 ? docs[docs.length - 1]?.id ?? null : null,
          }}
        />
      </div>
    </div>
  );
}

