import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import {
  CHAT_UPDATE_FIELD_SUCCESS,
  type ChatEditField,
} from "@/app/lib/transactions/chat-commands";
import { formatChatFailure } from "@/app/lib/transactions/parse-quick";

export const runtime = "nodejs";

const bodySchema = z.object({
  transactionId: z.string().uuid(),
  field: z.enum(["description", "vendor", "amount", "date"]),
  value: z.string().min(1).max(200),
});

function parseAmount(value: string): string | null {
  const s = value.trim().replace(/\s/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return n.toFixed(2);
}

function parseDate(value: string): Date | null {
  const t = value.trim();
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return dt;
    return null;
  }
  const local = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!local) return null;
  let y = Number(local[3]);
  if (y < 100) y += 2000;
  const mo = Number(local[2]);
  const d = Number(local[1]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
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
      { ok: false, reply: formatChatFailure("חסרים פרטים לעדכון.") },
      { status: 400 },
    );
  }

  const field = parsed.data.field as ChatEditField;
  const raw = parsed.data.value.trim();

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: parsed.data.transactionId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, reply: formatChatFailure("לא מצאתי את התנועה לעדכון.") },
        { status: 200 },
      );
    }

    const data: Record<string, string | Date | null> = {};
    if (field === "description") data.description = raw.slice(0, 200);
    if (field === "vendor") data.vendor = raw.slice(0, 120);
    if (field === "amount") {
      const amount = parseAmount(raw);
      if (!amount) {
        return NextResponse.json(
          { ok: false, reply: formatChatFailure("הסכום לא תקין.") },
          { status: 200 },
        );
      }
      data.amount = amount;
    }
    if (field === "date") {
      const date = parseDate(raw);
      if (!date) {
        return NextResponse.json(
          { ok: false, reply: formatChatFailure("התאריך לא תקין. לדוגמה: 15/9/2026") },
          { status: 200 },
        );
      }
      data.date = date;
    }

    await prisma.transaction.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ ok: true, reply: CHAT_UPDATE_FIELD_SUCCESS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאת שרת לא ידועה";
    return NextResponse.json(
      { ok: false, reply: formatChatFailure(`שגיאה בעדכון: ${msg}`) },
      { status: 500 },
    );
  }
}
