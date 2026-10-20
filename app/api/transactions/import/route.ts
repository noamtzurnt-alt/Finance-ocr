import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { parseStatementFile } from "@/app/lib/transactions/parse-statement";
import { classifyTransactions } from "@/app/lib/transactions/classify";
import { matchKey, pairWithStored, type StoredTx } from "@/app/lib/transactions/import-match";

export const runtime = "nodejs";

const rowShape = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string(),
  vendor: z.string().min(1).max(120),
  description: z.string().nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cardLast4: z.string().max(8).nullable().optional(),
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

      // One-to-one matching by day, amount, vendor and card (see import-match.ts).
      const pool = new Map<string, StoredTx[]>();
      for (const t of existing) {
        const key = matchKey(t.date.toISOString().slice(0, 10), t.amount.toString(), t.vendor);
        pool.set(key, [...(pool.get(key) ?? []), { id: t.id, cardLast4: t.cardLast4 }]);
      }
      const paired = pairWithStored(
        calRows.map((r) => ({ key: matchKey(r.date, r.amount, r.vendor), card: r.cardLast4 ?? null })),
        pool,
        new Set<string>(),
      );
      const withMatch = calRows.map((r, i) => ({ ...r, matchExisting: paired[i] != null }));

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

  /** The statement is the source of truth for the charge date; the card is only filled when empty. */
  const learnFromStatement = async (id: string, chargeDate: Date | null, cardLast4: string | null) => {
    if (chargeDate) {
      await prisma.transaction.updateMany({ where: { id, userId: user.id }, data: { chargeDate } });
    }
    if (cardLast4) {
      await prisma.transaction.updateMany({ where: { id, userId: user.id, cardLast4: null }, data: { cardLast4 } });
    }
  };

  type Prepared = {
    row: (typeof parsed.data.rows)[number];
    dt: Date;
    amount: string;
    vendor: string;
    chargeDate: Date | null;
    cardLast4: string | null;
    key: string;
  };
  const prepare = (row: (typeof parsed.data.rows)[number]): Prepared | null => {
    const dt = parseDateOnly(row.date);
    const n = Number(row.amount.replace(/,/g, ""));
    if (!dt || !Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
    const amount = n.toFixed(2);
    const vendor = row.vendor.trim();
    return {
      row,
      dt,
      amount,
      vendor,
      chargeDate: row.chargeDate ? parseDateOnly(row.chargeDate) : null,
      cardLast4: row.cardLast4?.trim() || parsed.data.cardLast4?.trim() || null,
      key: matchKey(row.date, amount, vendor),
    };
  };

  const preparedBackfill = parsed.data.backfill.map(prepare).filter((p): p is Prepared => p != null);
  const preparedRows: Array<Prepared | null> = parsed.data.rows.map(prepare);
  skipped += preparedRows.filter((p) => p == null).length;
  const valid = preparedRows.filter((p): p is Prepared => p != null);

  // Everything stored for the days and amounts in this request, loaded once.
  const pool = new Map<string, StoredTx[]>();
  const loaded = new Set<string>();
  for (const p of [...preparedBackfill, ...valid]) {
    if (loaded.has(p.key)) continue;
    loaded.add(p.key);
    pool.set(
      p.key,
      await prisma.transaction.findMany({
        where: { userId: user.id, date: p.dt, amount: p.amount, vendor: { equals: p.vendor, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
        select: { id: true, cardLast4: true },
      }),
    );
  }

  const used = new Set<string>();
  let updated = 0;

  // Rows that are already in the app: keep them and only learn the real charge date.
  const backfillPairs = pairWithStored(
    preparedBackfill.map((p) => ({ key: p.key, card: p.cardLast4 })),
    pool,
    used,
  );
  for (let i = 0; i < preparedBackfill.length; i++) {
    const stored = backfillPairs[i];
    if (!stored) continue;
    await learnFromStatement(stored.id, preparedBackfill[i].chargeDate, preparedBackfill[i].cardLast4);
    updated++;
  }

  // New rows. A row that turns out to exist already (second submit, or a file imported twice)
  // is not created again, it only refreshes the charge date.
  const rowPairs = pairWithStored(
    valid.map((p) => ({ key: p.key, card: p.cardLast4 })),
    pool,
    used,
  );
  for (let i = 0; i < valid.length; i++) {
    const p = valid[i];
    const stored = rowPairs[i];
    if (stored) {
      await learnFromStatement(stored.id, p.chargeDate, p.cardLast4);
      skipped++;
      continue;
    }
    try {
      const createdRow = await prisma.transaction.create({
        data: {
          userId: user.id,
          date: p.dt,
          amount: p.amount,
          currency: "ILS",
          vendor: p.vendor,
          description: p.row.description?.trim() || null,
          categoryId: p.row.categoryId && allowedCategoryIds.has(p.row.categoryId) ? p.row.categoryId : null,
          cardLast4: p.cardLast4,
          chargeDate: p.chargeDate,
        },
        select: { id: true },
      });
      created++;
      used.add(createdRow.id);
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, created, deleted, skipped, updated });
}
