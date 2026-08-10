import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import LiveRefresh from "@/app/ui/LiveRefresh";
import { MIN_EXPENSE_ARCHIVE_YEAR } from "@/app/lib/receipts/defaults";
import { ensureDefaultExpenseFolders } from "@/app/lib/receipts/ensure-folders";
import { parseArchiveMonth } from "@/app/lib/receipts/year-date";
import ReceiptFolderClient from "../../ui/ReceiptFolderClient";

export const dynamic = "force-dynamic";

export default async function ReceiptFolderPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const { id } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const yearParam = sp.year ? parseInt(sp.year, 10) : new Date().getFullYear();
  const year = Number.isFinite(yearParam)
    ? Math.max(MIN_EXPENSE_ARCHIVE_YEAR, yearParam)
    : new Date().getFullYear();
  const month = parseArchiveMonth(sp.month);

  await ensureDefaultExpenseFolders(user.id);

  const folder = await prisma.expenseFolder.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true, icon: true },
  });
  if (!folder) notFound();

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <ReceiptFolderClient
        userId={user.id}
        folderId={folder.id}
        year={year}
        month={month}
        folderName={folder.name}
        folderIcon={folder.icon}
      />
    </div>
  );
}
