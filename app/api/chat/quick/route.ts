import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { formatQuickReply, parseQuickTransaction, QUICK_HELP } from "@/app/lib/transactions/parse-quick";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", reply: QUICK_HELP }, { status: 400 });
  }

  const text = parsed.data.text.trim();
  const tx = parseQuickTransaction(text);
  if (!tx) {
    return NextResponse.json({ ok: false, reply: QUICK_HELP }, { status: 200 });
  }

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
    reply: formatQuickReply(tx, created.id),
    transaction: {
      id: created.id,
      vendor: created.vendor,
      amount: created.amount.toString(),
      currency: created.currency,
      date: new Date().toISOString().slice(0, 10),
    },
  });
}
