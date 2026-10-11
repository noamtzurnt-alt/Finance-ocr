import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import {
  CHAT_CATEGORY_SUCCESS,
  formatChatCategoryFailure,
} from "@/app/lib/transactions/parse-quick";
import { normalizeCategoryName } from "@/app/lib/transactions/chat-category";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    transactionId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    categoryName: z.string().min(1).max(60).optional(),
  })
  .refine((v) => Boolean(v.categoryId || v.categoryName), {
    message: "חסרה קטגוריה",
  });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reply: formatChatCategoryFailure("צריך להתחבר מחדש.") },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reply: formatChatCategoryFailure("הבקשה לא תקינה.") },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reply: formatChatCategoryFailure("חסר מזהה תנועה או קטגוריה.") },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: parsed.data.transactionId, userId: user.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, reply: formatChatCategoryFailure("לא מצאתי את התנועה לעדכון.") },
        { status: 200 },
      );
    }

    let categoryId = parsed.data.categoryId ?? null;
    let categoryName: string | null = null;

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId: user.id },
        select: { id: true, name: true },
      });
      if (!category) {
        return NextResponse.json(
          { ok: false, reply: formatChatCategoryFailure("הקטגוריה לא נמצאה.") },
          { status: 200 },
        );
      }
      categoryId = category.id;
      categoryName = category.name;
    } else {
      const name = normalizeCategoryName(parsed.data.categoryName ?? "");
      if (!name) {
        return NextResponse.json(
          { ok: false, reply: formatChatCategoryFailure("שם הקטגוריה ריק.") },
          { status: 200 },
        );
      }

      const found =
        (await prisma.category.findFirst({
          where: { userId: user.id, name },
          select: { id: true, name: true, budgetScope: true },
        })) ?? null;

      if (found) {
        if (!found.budgetScope) {
          await prisma.category.update({
            where: { id: found.id },
            data: { budgetScope: "personal" },
          });
        }
        categoryId = found.id;
        categoryName = found.name;
      } else {
        const created = await prisma.category.create({
          data: { userId: user.id, name, budgetScope: "personal" },
          select: { id: true, name: true },
        });
        categoryId = created.id;
        categoryName = created.name;
      }
    }

    const updated = await prisma.transaction.update({
      where: { id: existing.id },
      data: { categoryId },
      select: { id: true, vendor: true, categoryId: true },
    });

    return NextResponse.json({
      ok: true,
      reply: CHAT_CATEGORY_SUCCESS,
      transaction: {
        id: updated.id,
        vendor: updated.vendor,
        categoryId: updated.categoryId,
        categoryName,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאת שרת לא ידועה";
    return NextResponse.json(
      { ok: false, reply: formatChatCategoryFailure(`שגיאה בעדכון: ${msg}`) },
      { status: 500 },
    );
  }
}
