import { prisma } from "@/app/lib/prisma";

export async function ensureOwnedCategoryId(userId: string, categoryId: string | null | undefined) {
  const normalized = categoryId?.trim() || null;
  if (!normalized) return null;

  const category = await prisma.category.findFirst({
    where: { id: normalized, userId },
    select: { id: true },
  });

  return category?.id ?? null;
}
