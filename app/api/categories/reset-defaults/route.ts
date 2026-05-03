import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";

const DEFAULT_CATEGORIES = ["כללי", "אוכל", "רכב/דלק", "תוכנות/מנויים", "בגדים"];

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get כללי category (or create it)
  let fallback = await prisma.category.findFirst({
    where: { userId: user.id, name: "כללי" },
    select: { id: true },
  });
  if (!fallback) {
    fallback = await prisma.category.create({
      data: { userId: user.id, name: "כללי" },
      select: { id: true },
    });
  }

  // Reassign transactions from non-default categories to כללי
  const nonDefault = await prisma.category.findMany({
    where: { userId: user.id, name: { notIn: DEFAULT_CATEGORIES } },
    select: { id: true },
  });
  if (nonDefault.length > 0) {
    const nonDefaultIds = nonDefault.map((c) => c.id);
    await prisma.transaction.updateMany({
      where: { userId: user.id, categoryId: { in: nonDefaultIds } },
      data: { categoryId: fallback.id },
    });
    await prisma.document.updateMany({
      where: { userId: user.id, categoryId: { in: nonDefaultIds } },
      data: { categoryId: fallback.id },
    });
    await prisma.category.deleteMany({
      where: { userId: user.id, name: { notIn: DEFAULT_CATEGORIES } },
    });
  }

  // Create any missing default categories
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((name) => ({ userId: user.id, name })),
    skipDuplicates: true,
  });

  const result = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ ok: true, categories: result });
}
