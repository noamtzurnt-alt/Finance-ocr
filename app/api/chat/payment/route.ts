import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import {
  CHAT_PAYMENT_SUCCESS,
  formatChatPaymentFailure,
} from "@/app/lib/transactions/parse-quick";
import { normalizePaymentMethod } from "@/app/lib/transactions/chat-payment";

export const runtime = "nodejs";

const bodySchema = z.object({
  transactionId: z.string().uuid(),
  paymentMethod: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reply: formatChatPaymentFailure("צריך להתחבר מחדש.") },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reply: formatChatPaymentFailure("הבקשה לא תקינה.") },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reply: formatChatPaymentFailure("חסר מזהה תנועה או אמצעי תשלום.") },
      { status: 400 },
    );
  }

  const paymentMethod = normalizePaymentMethod(parsed.data.paymentMethod);
  if (!paymentMethod) {
    return NextResponse.json(
      { ok: false, reply: formatChatPaymentFailure("אמצעי התשלום ריק.") },
      { status: 200 },
    );
  }

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: parsed.data.transactionId, userId: user.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, reply: formatChatPaymentFailure("לא מצאתי את התנועה לעדכון.") },
        { status: 200 },
      );
    }

    const updated = await prisma.transaction.update({
      where: { id: existing.id },
      data: { cardLast4: paymentMethod },
      select: { id: true, vendor: true, cardLast4: true },
    });

    return NextResponse.json({
      ok: true,
      reply: CHAT_PAYMENT_SUCCESS,
      transaction: {
        id: updated.id,
        vendor: updated.vendor,
        paymentMethod: updated.cardLast4,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאת שרת לא ידועה";
    return NextResponse.json(
      { ok: false, reply: formatChatPaymentFailure(`שגיאה בעדכון: ${msg}`) },
      { status: 500 },
    );
  }
}
