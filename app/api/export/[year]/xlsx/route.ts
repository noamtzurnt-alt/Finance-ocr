import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import * as ExcelJS from "exceljs";

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

function toExpenseRow(d: {
  date: Date;
  vendor: string;
  docNumber: string | null;
  category: { name: string } | null;
  amount: { toNumber(): number };
  vatAmount: { toNumber(): number };
  preVatAmount: { toNumber(): number };
  isRecognized: { toNumber(): number };
  description: string | null;
  fileName: string;
}) {
  return {
    תאריך: d.date.toISOString().slice(0, 10),
    ספק: d.vendor,
    "מספר מסמך": d.docNumber ?? "",
    קטגוריה: d.category?.name ?? "",
    "סה״כ (₪)": d.amount.toNumber(),
    "מע״מ (₪)": d.vatAmount.toNumber(),
    "לפני מע״מ (₪)": d.preVatAmount.toNumber(),
    "הוצאה מוכרת (%)": d.isRecognized.toNumber(),
    תיאור: d.description ?? "",
    "שם קובץ": d.fileName,
  };
}

function toReceiptRow(d: {
  date: Date;
  vendor: string;
  docNumber: string | null;
  amount: { toNumber(): number };
  vatAmount: { toNumber(): number };
  preVatAmount: { toNumber(): number };
  description: string | null;
  fileName: string;
}) {
  return {
    תאריך: d.date.toISOString().slice(0, 10),
    לקוח: d.vendor,
    "מספר קבלה": d.docNumber ?? "",
    "סה״כ (₪)": d.amount.toNumber(),
    "מע״מ (₪)": d.vatAmount.toNumber(),
    "לפני מע״מ (₪)": d.preVatAmount.toNumber(),
    תיאור: d.description ?? "",
    "שם קובץ": d.fileName,
  };
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

  // Only the two document types that go to the accountant.
  const docs = await prisma.document.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lt: end },
      type: { in: ["expense", "payment_receipt"] },
    },
    orderBy: { date: "asc" },
    include: { category: { select: { name: true } } },
  });

  const expenses = docs.filter((d) => d.type === "expense");
  const receipts = docs.filter((d) => d.type === "payment_receipt");

  const expenseRows = expenses.map(toExpenseRow);
  const receiptRows = receipts.map(toReceiptRow);

  const totalExp = expenseRows.reduce((s, r) => s + r["סה״כ (₪)"], 0);
  const totalVatExp = expenseRows.reduce((s, r) => s + r["מע״מ (₪)"], 0);
  const totalReceipts = receiptRows.reduce((s, r) => s + r["סה״כ (₪)"], 0);
  const totalVatReceipts = receiptRows.reduce((s, r) => s + r["מע״מ (₪)"], 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Finance OCR";
  wb.created = new Date();

  // Document 1 — all recognized expenses for the year
  addSheetFromRows(wb, `הוצאות_מוכרות_${y}`, expenseRows);
  // Document 2 — all income receipts for the year
  addSheetFromRows(wb, `קבלות_הכנסות_${y}`, receiptRows);

  addSheetFromRows(wb, "סיכום", [
    { נושא: "שנה", ערך: y },
    { נושא: "מספר הוצאות מוכרות", ערך: expenses.length },
    { נושא: "סה״כ הוצאות מוכרות (₪)", ערך: totalExp },
    { נושא: "מע״מ תשומות (הוצאות) (₪)", ערך: totalVatExp },
    { נושא: "מספר קבלות הכנסה", ערך: receipts.length },
    { נושא: "סה״כ קבלות הכנסה (₪)", ערך: totalReceipts },
    { נושא: "מע״מ עסקאות (קבלות) (₪)", ערך: totalVatReceipts },
  ]);

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="accountant_${y}_expenses_and_receipts.xlsx"`,
    },
  });
}
