import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { parseStatementFile } from "@/app/lib/transactions/parse-statement";
import { classifyTransactions } from "@/app/lib/transactions/classify";

export const runtime = "nodejs";

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount: z.string(),
        vendor: z.string().min(1).max(120),
        description: z.string().nullable().optional(),
        categoryId: z.string().min(1).nullable().optional(),
      }),
    )
    .max(500)
    .default([]),
  deleteIds: z.array(z.string().uuid()).max(500).default([]),
  cardLast4: z.string().max(8).nullable().optional(),
  isFixed: z.boolean().optional(),
});

function parseDateOnly(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
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

      const existingKeys = new Set(
        existing.map((t) =>
          rowKey(t.date.toISOString().slice(0, 10), t.amount.toString(), t.vendor),
        ),
      );

      return NextResponse.json({
        fileName: file.name,
        range: minDate && maxDate
          ? {
              from: minDate.toISOString().slice(0, 10),
              to: maxDate.toISOString().slice(0, 10),
            }
          : null,
        calRows: calRows.map((r, index) => ({
          ...r,
          matchExisting: existingKeys.has(rowKey(r.date, r.amount, r.vendor)),
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

  // Stage 2: confirm merge — create kept CAL rows + delete trashed existing
  const json = await req.json().catch(() => null);
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.rows.length === 0 && parsed.data.deleteIds.length === 0) {
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

  for (const row of parsed.data.rows) {
    const dt = parseDateOnly(row.date);
    const n = Number(row.amount.replace(/,/g, ""));
    if (!dt || !Number.isFinite(n) || n <= 0 || n > 1_000_000) {
      skipped++;
      continue;
    }

    const amount = n.toFixed(2);
    const vendor = row.vendor.trim();

    const existing = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        date: dt,
        amount,
        vendor: { equals: vendor, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          date: dt,
          amount,
          currency: "ILS",
          vendor,
          description: row.description?.trim() || null,
          categoryId: row.categoryId && allowedCategoryIds.has(row.categoryId) ? row.categoryId : null,
          cardLast4: parsed.data.cardLast4?.trim() || null,
          isFixed: parsed.data.isFixed ?? false,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, created, deleted, skipped });
}
