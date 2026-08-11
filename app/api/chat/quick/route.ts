import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import {
  CHAT_SUCCESS_REPLY,
  formatChatFailure,
  parseQuickTransactionDetailed,
} from "@/app/lib/transactions/parse-quick";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reply: formatChatFailure("צריך להתחבר מחדש כדי להוסיף תנועה.") },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reply: formatChatFailure("הבקשה לא תקינה (JSON).") },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reply: formatChatFailure("ההודעה ריקה או ארוכה מדי.") },
      { status: 400 },
    );
  }

  const text = parsed.data.text.trim();
  const result = parseQuickTransactionDetailed(text);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reply: formatChatFailure(result.reason) }, { status: 200 });
  }

  const tx = result.tx;

  try {
    const defaultCategoryName = "כללי";
    const category =
      (await prisma.category.findFirst({
        where: { userId: user.id, name: defaultCategoryName },
        select: { id: true },
      })) ??
      (await prisma.category.create({
        data: { userId: user.id, name: defaultCategoryName },
        select: { id: true },
      }));

    const created = await prisma.transaction.create({
      data: {
        userId: user.id,
        date: new Date(),
        amount: tx.amount.toFixed(2),
        currency: tx.currency,
        vendor: tx.vendor,
        description: null,
        categoryId: category.id,
        cardLast4: null,
      },
      select: { id: true, vendor: true, amount: true, currency: true },
    });

    return NextResponse.json({
      ok: true,
      reply: CHAT_SUCCESS_REPLY,
      transaction: {
        id: created.id,
        vendor: created.vendor,
        amount: created.amount.toString(),
        currency: created.currency,
        date: new Date().toISOString().slice(0, 10),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאת שרת לא ידועה";
    return NextResponse.json(
      { ok: false, reply: formatChatFailure(`שגיאה בשמירה למסד הנתונים: ${msg}`) },
      { status: 500 },
    );
  }
}
