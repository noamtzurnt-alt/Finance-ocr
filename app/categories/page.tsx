import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import CategoriesClient from "./ui/CategoriesClient";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function CategoriesPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">קטגוריות</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">נהל קטגוריות להוצאות (משמש גם לייצוא).</p>
        </div>
        <a className="btn" href="/dashboard">
          חזרה לדשבורד
        </a>
      </div>

      <div className="card p-4">
        <CategoriesClient initial={categories} />
      </div>
    </div>
  );
}


