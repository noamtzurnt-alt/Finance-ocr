import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectBytes } from "@/app/lib/r2/objects";
import archiver from "archiver";
import { Readable } from "stream";
import * as ExcelJS from "exceljs";

export const runtime = "nodejs";
export const maxDuration = 120;

function addSheetFromRows(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    const ws = wb.addWorksheet(name);
    ws.addRow(["אין מסמכים לשנה זו"]);
    return;
  }
  const ws = wb.addWorksheet(name);
  const keys = Object.keys(rows[0]!);
  ws.columns = keys.map((k) => ({ header: k, key: k, width: Math.min(28, Math.max(12, k.length + 2)) }));
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true };
}

async function buildWorkbook(sheetName: string, rows: Record<string, unknown>[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Finance OCR";
  wb.created = new Date();
  addSheetFromRows(wb, sheetName, rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function safeName(name: string) {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "ללא_שם";
}

function uniquePath(used: Set<string>, path: string) {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = path.lastIndexOf(".");
  const base = dot > 0 ? path.slice(0, dot) : path;
  const ext = dot > 0 ? path.slice(dot) : "";
  let i = 2;
  let candidate = `${base}_${i}${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base}_${i}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

export async function GET(_req: Request, ctx: { params: Promise<{ year: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { year } = await ctx.params;
  const y = parseInt(year, 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);

  const docs = await prisma.document.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lt: end },
      type: { in: ["expense", "payment_receipt"] },
    },
    orderBy: { date: "asc" },
    include: {
      category: { select: { name: true } },
      expenseFolder: { select: { name: true } },
    },
  });

  const expenses = docs.filter((d) => d.type === "expense");
  const receipts = docs.filter((d) => d.type === "payment_receipt");

  const expenseRows = expenses.map((d) => ({
    תאריך: d.date.toISOString().slice(0, 10),
    ספק: d.vendor,
    "מספר מסמך": d.docNumber ?? "",
    קטגוריה: d.category?.name ?? "",
    תיקייה: d.expenseFolder?.name ?? "",
    "סה״כ (₪)": d.amount.toNumber(),
    "מע״מ (₪)": d.vatAmount.toNumber(),
    "לפני מע״מ (₪)": d.preVatAmount.toNumber(),
    "הוצאה מוכרת (%)": d.isRecognized.toNumber(),
    תיאור: d.description ?? "",
    "שם קובץ": d.fileName,
  }));

  const receiptRows = receipts.map((d) => ({
    תאריך: d.date.toISOString().slice(0, 10),
    לקוח: d.vendor,
    "מספר קבלה": d.docNumber ?? "",
    "סה״כ (₪)": d.amount.toNumber(),
    "מע״מ (₪)": d.vatAmount.toNumber(),
    "לפני מע״מ (₪)": d.preVatAmount.toNumber(),
    תיאור: d.description ?? "",
    "שם קובץ": d.fileName,
  }));

  // Two separate Excel documents for the accountant.
  const expensesXlsx = await buildWorkbook(`הוצאות_מוכרות_${y}`, expenseRows);
  const receiptsXlsx = await buildWorkbook(`קבלות_הכנסות_${y}`, receiptRows);

  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new Readable({ read() {} });

  archive.on("data", (chunk: Buffer) => stream.push(chunk));
  archive.on("end", () => stream.push(null));
  archive.on("error", (err: Error) => {
    throw err;
  });

  archive.append(expensesXlsx, { name: `1_הוצאות_מוכרות_${y}.xlsx` });
  archive.append(receiptsXlsx, { name: `2_קבלות_הכנסות_${y}.xlsx` });

  const usedPaths = new Set<string>();

  for (const d of expenses) {
    try {
      const bytes = await getObjectBytes(d.fileKey);
      if (!bytes) continue;
      const month = d.date.toISOString().slice(0, 7);
      const folder = safeName(d.expenseFolder?.name ?? "כללי");
      const fileName = safeName(d.fileName);
      const path = uniquePath(
        usedPaths,
        `1_הוצאות_מוכרות_${y}/קבצים/${month}/${folder}/${fileName}`,
      );
      archive.append(Buffer.from(bytes), { name: path });
    } catch {
      // skip missing files
    }
  }

  for (const d of receipts) {
    try {
      const bytes = await getObjectBytes(d.fileKey);
      if (!bytes) continue;
      const month = d.date.toISOString().slice(0, 7);
      const fileName = safeName(d.fileName);
      const path = uniquePath(
        usedPaths,
        `2_קבלות_הכנסות_${y}/קבצים/${month}/${fileName}`,
      );
      archive.append(Buffer.from(bytes), { name: path });
    } catch {
      // skip missing files
    }
  }

  void archive.finalize();

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="accountant_${y}.zip"`,
    },
  });
}
