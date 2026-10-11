import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import CategoriesClient from "./ui/CategoriesClient";
import LiveRefresh from "@/app/ui/LiveRefresh";
import PageHeader from "@/app/ui/PageHeader";

export default async function CategoriesPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <LiveRefresh />
      <PageHeader
        title="קטגוריות"
        subtitle="נהל קטגוריות להוצאות (משמש גם לייצוא)"
      />

      <div className="card p-4">
        <CategoriesClient initial={categories} />
      </div>
    </div>
  );
}


