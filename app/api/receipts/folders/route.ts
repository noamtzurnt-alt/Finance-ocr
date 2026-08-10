import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { ensureDefaultExpenseFolders } from "@/app/lib/receipts/ensure-folders";
import { MIN_EXPENSE_ARCHIVE_YEAR } from "@/app/lib/receipts/defaults";
import { archiveDateBounds, parseArchiveMonth } from "@/app/lib/receipts/year-date";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().max(8).optional(),
  year: z.number().int().min(MIN_EXPENSE_ARCHIVE_YEAR).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const year = Math.max(
    MIN_EXPENSE_ARCHIVE_YEAR,
    parseInt(url.searchParams.get("year") || String(new Date().getFullYear()), 10),
  );
  const month = parseArchiveMonth(url.searchParams.get("month"));
  const { start, end } = archiveDateBounds(year, month);

  await ensureDefaultExpenseFolders(user.id);

  const folders = await prisma.expenseFolder.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      icon: true,
      sortOrder: true,
      _count: {
        select: {
          documents: {
            where: {
              type: "expense",
              date: { gte: start, lt: end },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    year,
    month,
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      sortOrder: f.sortOrder,
      docCount: f._count.documents,
    })),
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = createSchema.parse(await req.json());
  await ensureDefaultExpenseFolders(user.id);

  const maxOrder = await prisma.expenseFolder.aggregate({
    where: { userId: user.id },
    _max: { sortOrder: true },
  });

  try {
    const folder = await prisma.expenseFolder.create({
      data: {
        userId: user.id,
        name: body.name,
        icon: body.icon || "📁",
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      select: { id: true, name: true, icon: true, sortOrder: true },
    });

    return NextResponse.json({ folder, docCount: 0 });
  } catch {
    return NextResponse.json({ error: "קטגוריה בשם זה כבר קיימת" }, { status: 409 });
  }
}
