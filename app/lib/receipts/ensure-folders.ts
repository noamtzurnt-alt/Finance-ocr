import { prisma } from "@/app/lib/prisma";
import { DEFAULT_EXPENSE_FOLDERS } from "./defaults";

export async function ensureDefaultExpenseFolders(userId: string) {
  const existing = await prisma.expenseFolder.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.expenseFolder.createMany({
    data: DEFAULT_EXPENSE_FOLDERS.map((f) => ({
      userId,
      name: f.name,
      icon: f.icon,
      sortOrder: f.sortOrder,
    })),
  });
}
