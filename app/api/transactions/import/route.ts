import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { parseStatementFile } from "@/app/lib/transactions/parse-statement";
import { classifyTransactions } from "@/app/lib/transactions/classify";

export const runtime = "nodejs";

const rowShape = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string(),
  vendor: z.string().min(1).max(120),
  description: z.string().nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cardLast4: z.string().max(8).nullable().optional(),
  /** 1 for the first row with this date/amount/vendor in the file, 2 for the second, and so on. */
  occurrence: z.number().int().min(1).max(50).optional(),
});

const importSchema = z.object({
  rows: z.array(rowShape).max(500).default([]),
  /** Rows already in the app: only learn their charge date and card, never create or delete. */
  backfill: z.array(rowShape).max(500).default([]),
  deleteIds: z.array(z.string().uuid()).max(500).default([]),
  cardLast4: z.string().max(8).nullable().optional(),
});

function parseDateOnly(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function rowKey(date: string, amount: string, vendor: string) {
  return `${date}|${Number(amount).toFixed(2)}|${vendor.trim().toLowerCase()}`;
}

/** Parse uploaded Excel/CSV from CAL into preview + existing manual rows in range. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";

  // Stage 1: file upload → merge preview payload
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "הקובץ גדול מדי (מקס׳ 8MB)" }, { status: 400 });
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const calRows = await parseStatementFile({
        buffer,
        fileName: file.name,
        mimeType: file.type,
      });

      const dates = [...new Set(calRows.map((r) => r.date))];
      const dateObjs = dates.map(parseDateOnly).filter((d): d is Date => d != null);
      const minDate = dateObjs.length
        ? new Date(Math.min(...dateObjs.map((d) => d.getTime())))
        : null;
      const maxDate = dateObjs.length
        ? new Date(Math.max(...dateObjs.map((d) => d.getTime())))
        : null;

      const existing =
        minDate && maxDate
          ? await prisma.transaction.findMany({
              where: {
                userId: user.id,
                date: { gte: minDate, lte: maxDate },
              },
              orderBy: [{ date: "desc" }, { createdAt: "desc" }],
              include: { category: { select: { name: true, budgetScope: true } } },
              take: 500,
            })
          : [];
      const categories = await prisma.category.findMany({
        where: { userId: user.id, budgetScope: { not: null } },
        select: { id: true, name: true, budgetScope: true },
      });
      const scopedCategories = categories.filter(
        (category): category is { id: string; name: string; budgetScope: "personal" | "business" } =>
          category.budgetScope === "personal" || category.budgetScope === "business",
      );
      const history = await prisma.transaction.findMany({
        where: { userId: user.id, categoryId: { not: null } },
        orderBy: { date: "desc" },
        take: 1500,
        select: { vendor: true, categoryId: true },
      });
      const classifications = classifyTransactions({
        vendors: calRows.map((row) => row.vendor),
        categories: scopedCategories,
        history,
      });

      // Count-based matching: two identical purchases in the file only match two stored ones.
      const existingCount = new Map<string, number>();
      for (const t of existing) {
        const key = rowKey(t.date.toISOString().slice(0, 10), t.amount.toString(), t.vendor);
        existingCount.set(key, (existingCount.get(key) ?? 0) + 1);
      }
      const seenInFile = new Map<string, number>();
      const withMatch = calRows.map((r) => {
        const key = rowKey(r.date, r.amount, r.vendor);
        const occurrence = (seenInFile.get(key) ?? 0) + 1;
        seenInFile.set(key, occurrence);
        return { ...r, occurrence, matchExisting: occurrence <= (existingCount.get(key) ?? 0) };
      });

      return NextResponse.json({
        fileName: file.name,
        range: minDate && maxDate
          ? {
              from: minDate.toISOString().slice(0, 10),
              to: maxDate.toISOString().slice(0, 10),
            }
          : null,
        calRows: withMatch.map((r, index) => ({
          ...r,
          ...classifications[index],
        })),
        existingRows: existing.map((t) => ({
          id: t.id,
          date: t.date.toISOString().slice(0, 10),
          amount: t.amount.toString(),
          vendor: t.vendor,
          description: t.description,
          categoryName: t.category?.name ?? null,
          categoryScope: t.category?.budgetScope ?? null,
          cardLast4: t.cardLast4,
        })),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "שגיאה בפענוח הקובץ";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Stage 2: confirm merge, create kept CAL rows + delete trashed existing
  const json = await req.json().catch(() => null);
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.rows.length === 0 && parsed.data.deleteIds.length === 0 && parsed.data.backfill.length === 0) {
    return NextResponse.json({ error: "אין שינויים לשמירה" }, { status: 400 });
  }

  const requestedCategoryIds = [
    ...new Set(
      parsed.data.rows
        .map((row) => row.categoryId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const allowedCategories = requestedCategoryIds.length
    ? await prisma.category.findMany({
        where: { userId: user.id, id: { in: requestedCategoryIds } },
        select: { id: true },
      })
    : [];
  const allowedCategoryIds = new Set(allowedCategories.map((category) => category.id));
  if (allowedCategoryIds.size !== requestedCategoryIds.length) {
    return NextResponse.json({ error: "נבחרה קטגוריה לא חוקית" }, { status: 400 });
  }

  let created = 0;
  let deleted = 0;
  let skipped = 0;

  if (parsed.data.deleteIds.length > 0) {
    const result = await prisma.transaction.deleteMany({
      where: { userId: user.id, id: { in: parsed.data.deleteIds } },
    });
    deleted = result.count;
  }

  type StoredRef = { id: string };
  const storedByKey = new Map<string, StoredRef[]>();
  const storedFor = async (dt: Date, amount: string, vendor: string) => {
    const key = rowKey(dt.toISOString().slice(0, 10), amount, vendor);
    let list = storedByKey.get(key);
    if (!list) {
      list = await prisma.transaction.findMany({
        where: { userId: user.id, date: dt, amount, vendor: { equals: vendor, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      storedByKey.set(key, list);
    }
    return list;
  };

  /** The statement is the source of truth for the charge date; the card is only filled when empty. */
  const learnFromStatement = async (id: string, chargeDate: Date | null, cardLast4: string | null) => {
    if (chargeDate) {
      await prisma.transaction.updateMany({ where: { id, userId: user.id }, data: { chargeDate } });
    }
    if (cardLast4) {
      await prisma.transaction.updateMany({ where: { id, userId: user.id, cardLast4: null }, data: { cardLast4 } });
    }
  };

  let updated = 0;

  for (const row of parsed.data.backfill) {
    const dt = parseDateOnly(row.date);
    const n = Number(row.amount.replace(/,/g, ""));
    if (!dt || !Number.isFinite(n) || n <= 0) continue;
    const list = await storedFor(dt, n.toFixed(2), row.vendor.trim());
    const target = list[(row.occurrence ?? 1) - 1];
    if (!target) continue;
    await learnFromStatement(
      target.id,
      row.chargeDate ? parseDateOnly(row.chargeDate) : null,
      row.cardLast4?.trim() || parsed.data.cardLast4?.trim() || null,
    );
    updated++;
  }

  for (const row of parsed.data.rows) {
    const dt = parseDateOnly(row.date);
    const n = Number(row.amount.replace(/,/g, ""));
    if (!dt || !Number.isFinite(n) || n <= 0 || n > 1_000_000) {
      skipped++;
      continue;
    }

    const amount = n.toFixed(2);
    const vendor = row.vendor.trim();
    const chargeDate = row.chargeDate ? parseDateOnly(row.chargeDate) : null;
    const cardLast4 = row.cardLast4?.trim() || parsed.data.cardLast4?.trim() || null;

    // The Nth identical row in the file is only new when fewer than N are already stored.
    // Importing the same or an overlapping file again therefore never duplicates anything.
    const list = await storedFor(dt, amount, vendor);
    const occurrence = row.occurrence ?? 1;
    if (list.length >= occurrence) {
      await learnFromStatement(list[occurrence - 1].id, chargeDate, cardLast4);
      skipped++;
      continue;
    }

    try {
      const createdRow = await prisma.transaction.create({
        data: {
          userId: user.id,
          date: dt,
          amount,
          currency: "ILS",
          vendor,
          description: row.description?.trim() || null,
          categoryId: row.categoryId && allowedCategoryIds.has(row.categoryId) ? row.categoryId : null,
          cardLast4,
          chargeDate,
        },
        select: { id: true },
      });
      list.push({ id: createdRow.id });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, created, deleted, skipped, updated });
}
