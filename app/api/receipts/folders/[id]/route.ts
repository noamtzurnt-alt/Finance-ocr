import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { MIN_EXPENSE_ARCHIVE_YEAR } from "@/app/lib/receipts/defaults";
import { archiveDateBounds, parseArchiveMonth } from "@/app/lib/receipts/year-date";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const year = Math.max(
    MIN_EXPENSE_ARCHIVE_YEAR,
    parseInt(url.searchParams.get("year") || String(new Date().getFullYear()), 10),
  );
  const month = parseArchiveMonth(url.searchParams.get("month"));
  const { start, end } = archiveDateBounds(year, month);

  const folder = await prisma.expenseFolder.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true, icon: true },
  });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const documents = await prisma.document.findMany({
    where: {
      userId: user.id,
      type: "expense",
      expenseFolderId: id,
      date: { gte: start, lt: end },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      date: true,
      vendor: true,
      amount: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    year,
    month,
    folder,
    documents: documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileMime: d.fileMime,
      fileSize: d.fileSize,
      date: d.date.toISOString(),
      vendor: d.vendor,
      amount: d.amount.toString(),
      createdAt: d.createdAt.toISOString(),
    })),
  });
}
