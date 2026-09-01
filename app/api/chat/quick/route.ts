import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import {
  CHAT_PAYMENT_PROMPT,
  CHAT_SUCCESS_REPLY,
  formatChatFailure,
  formatChatParseFailure,
  parseChatIntent,
} from "@/app/lib/transactions/parse-quick";
import { normalizeVendor } from "@/app/lib/transactions/classify";
import {
  CHAT_DELETE_BY_INDEX_SUCCESS,
  editPrompt,
} from "@/app/lib/transactions/chat-commands";
import { formatTransactionList } from "@/app/lib/transactions/chat-list";
import {
  fetchListedTransactions,
  getTransactionByListIndex,
} from "@/app/lib/transactions/chat-transactions";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(500),
});

function amountsEqual(a: { toString(): string } | number | string, b: number) {
  return Number(a.toString()) === b;
}

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
  const intent = parseChatIntent(text);

  if (intent.type === "unknown") {
    return NextResponse.json(
      { ok: false, reply: formatChatParseFailure(intent.reason) },
      { status: 200 },
    );
  }

  try {
    if (intent.type === "list") {
      const now = new Date();
      const rows = await fetchListedTransactions(user.id, now);
      return NextResponse.json({
        ok: true,
        step: "list",
        reply: formatTransactionList(rows, now),
      });
    }

    if (intent.type === "deleteByIndex") {
      const row = await getTransactionByListIndex(user.id, intent.index);
      if (!row) {
        return NextResponse.json(
          {
            ok: false,
            reply: formatChatFailure(`לא מצאתי תנועה מספר ${intent.index} ברשימה.`),
          },
          { status: 200 },
        );
      }

      await prisma.transaction.delete({ where: { id: row.id } });
      return NextResponse.json({
        ok: true,
        reply: CHAT_DELETE_BY_INDEX_SUCCESS,
        deleted: { id: row.id, vendor: row.vendor, amount: row.amount },
      });
    }

    if (intent.type === "editByIndex") {
      const row = await getTransactionByListIndex(user.id, intent.index);
      if (!row) {
        return NextResponse.json(
          {
            ok: false,
            reply: formatChatFailure(`לא מצאתי תנועה מספר ${intent.index} ברשימה.`),
          },
          { status: 200 },
        );
      }

      const reply = editPrompt(intent.field, intent.index);
      if (intent.field === "payment") {
        return NextResponse.json({
          ok: true,
          step: "edit_payment",
          reply,
          transaction: {
            id: row.id,
            vendor: row.vendor,
            amount: row.amount,
            currency: row.currency,
            description: row.description,
            date: row.date,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        step: "edit_input",
        reply,
        edit: {
          transactionId: row.id,
          field: intent.field,
          index: intent.index,
        },
      });
    }

    if (intent.type === "delete") {
      const wantedVendor = normalizeVendor(intent.vendor);
      const recent = await prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: [{ createdAt: "desc" }],
        take: 80,
        select: { id: true, vendor: true, amount: true, currency: true, createdAt: true },
      });

      const match = recent.find((row) => {
        const vendorOk =
          normalizeVendor(row.vendor) === wantedVendor ||
          normalizeVendor(row.vendor).includes(wantedVendor) ||
          wantedVendor.includes(normalizeVendor(row.vendor));
        if (!vendorOk) return false;
        if (intent.amount == null) return true;
        if (!amountsEqual(row.amount, intent.amount)) return false;
        if (intent.currency && row.currency !== intent.currency) return false;
        return true;
      });

      if (!match) {
        const hint =
          intent.amount != null
            ? `לא מצאתי תנועה בשם “${intent.vendor}” בסכום ${intent.amount}.`
            : `לא מצאתי תנועה בשם “${intent.vendor}”.`;
        return NextResponse.json({ ok: false, reply: formatChatFailure(hint) }, { status: 200 });
      }

      await prisma.transaction.delete({ where: { id: match.id } });
      return NextResponse.json({
        ok: true,
        reply: CHAT_SUCCESS_REPLY,
        deleted: { id: match.id, vendor: match.vendor, amount: match.amount.toString() },
      });
    }

    const tx = intent.tx;
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
        description: tx.description,
        categoryId: category.id,
        cardLast4: null,
      },
      select: { id: true, vendor: true, amount: true, currency: true, description: true },
    });

    return NextResponse.json({
      ok: true,
      step: "payment",
      reply: CHAT_PAYMENT_PROMPT,
      transaction: {
        id: created.id,
        vendor: created.vendor,
        amount: created.amount.toString(),
        currency: created.currency,
        description: created.description,
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
