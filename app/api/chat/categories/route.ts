import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { syncBudgetCategoriesForUser } from "@/app/lib/categories/budget";
import { formatChatFailure } from "@/app/lib/transactions/parse-quick";
import {
  CHAT_CATEGORY_ADD_SUCCESS,
  CHAT_CATEGORY_DELETE_SUCCESS,
  formatCategoryList,
  normalizeCategoryName,
} from "@/app/lib/transactions/chat-category";

export const runtime = "nodejs";

function parseCategoryJson(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("add"), name: z.string().min(1).max(60) }),
  z.object({ action: z.literal("delete"), index: z.number().int().min(1).max(999) }),
]);

async function loadOrderedCategories(userId: string) {
  const rows = await prisma.category.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });
  rows.sort((a, b) => {
    if (a.name === "כללי") return -1;
    if (b.name === "כללי") return 1;
    return a.name.localeCompare(b.name, "he");
  });
  return rows.map((row, i) => ({ index: i + 1, id: row.id, name: row.name }));
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reply: formatChatFailure("צריך להתחבר מחדש.") },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reply: formatChatFailure("הבקשה לא תקינה.") },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reply: formatChatFailure("הבקשה לא תקינה.") },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.action === "list") {
      const profile = await prisma.financialProfile.findUnique({
        where: { userId: user.id },
        select: { personalCategories: true, businessCategories: true },
      });
      await syncBudgetCategoriesForUser(user.id, {
        personal: parseCategoryJson(profile?.personalCategories),
        business: parseCategoryJson(profile?.businessCategories),
      });

      const rows = await loadOrderedCategories(user.id);
      return NextResponse.json({
        ok: true,
        reply: formatCategoryList(rows),
        count: rows.length,
        categories: rows.map((row) => ({ id: row.id, name: row.name })),
      });
    }

    if (parsed.data.action === "add") {
      const name = normalizeCategoryName(parsed.data.name);
      if (!name) {
        return NextResponse.json(
          { ok: false, reply: formatChatFailure("שם הקטגוריה ריק.") },
          { status: 200 },
        );
      }

      const existing = await prisma.category.findFirst({
        where: { userId: user.id, name },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { ok: false, reply: formatChatFailure(`הקטגוריה “${name}” כבר קיימת.`) },
          { status: 200 },
        );
      }

      await prisma.category.create({
        data: { userId: user.id, name, budgetScope: "personal" },
      });

      return NextResponse.json({ ok: true, reply: CHAT_CATEGORY_ADD_SUCCESS });
    }

    // action === "delete"
    const deleteIndex = parsed.data.index;
    const rows = await loadOrderedCategories(user.id);
    const target = rows.find((r) => r.index === deleteIndex);
    if (!target) {
      return NextResponse.json(
        {
          ok: false,
          reply: formatChatFailure(`לא מצאתי קטגוריה מספר ${deleteIndex}.`),
        },
        { status: 200 },
      );
    }

    if (target.name === "כללי") {
      return NextResponse.json(
        { ok: false, reply: formatChatFailure("אי אפשר למחוק את קטגוריית כללי.") },
        { status: 200 },
      );
    }

    let fallback = await prisma.category.findFirst({
      where: { userId: user.id, name: "כללי" },
      select: { id: true },
    });
    if (!fallback) {
      fallback = await prisma.category.create({
        data: { userId: user.id, name: "כללי", budgetScope: "personal" },
        select: { id: true },
      });
    }

    await prisma.transaction.updateMany({
      where: { userId: user.id, categoryId: target.id },
      data: { categoryId: fallback.id },
    });
    await prisma.document.updateMany({
      where: { userId: user.id, categoryId: target.id },
      data: { categoryId: fallback.id },
    });
    await prisma.category.delete({ where: { id: target.id } });

    return NextResponse.json({ ok: true, reply: CHAT_CATEGORY_DELETE_SUCCESS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאת שרת לא ידועה";
    return NextResponse.json(
      { ok: false, reply: formatChatFailure(`שגיאה: ${msg}`) },
      { status: 500 },
    );
  }
}
