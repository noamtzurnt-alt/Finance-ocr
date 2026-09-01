import { prisma } from "@/app/lib/prisma";

export const EMAIL_INBOX_FOLDER_NAME = "מהמייל";

export async function ensureEmailInboxFolder(userId: string) {
  const existing = await prisma.expenseFolder.findFirst({
    where: { userId, name: EMAIL_INBOX_FOLDER_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;

  const folder = await prisma.expenseFolder.create({
    data: {
      userId,
      name: EMAIL_INBOX_FOLDER_NAME,
      icon: "📧",
      sortOrder: -1,
    },
    select: { id: true },
  });
  return folder.id;
}
