import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/lib/auth/server";
import { putObject } from "@/app/lib/r2/objects";
import { createExpenseDocument } from "@/app/lib/receipts/create-expense";
import { ensureEmailInboxFolder } from "@/app/lib/gmail/email-folder";
import { parseArchiveMonth } from "@/app/lib/receipts/year-date";
import { MIN_EXPENSE_ARCHIVE_YEAR } from "@/app/lib/receipts/defaults";
import { analyzeExpenseFile } from "@/app/lib/receipts/analyze-expense-file";

const ALLOWED_PREFIXES = ["image/", "application/pdf", "text/html"];

function isAllowedFile(file: File) {
  if (ALLOWED_PREFIXES.some((p) => file.type.startsWith(p))) return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".pdf") || /\.(jpe?g|png|gif|webp|heic|heif|html)$/.test(lower);
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const year = Math.max(
    MIN_EXPENSE_ARCHIVE_YEAR,
    parseInt(String(formData.get("year") || new Date().getFullYear()), 10),
  );
  const month = parseArchiveMonth(String(formData.get("month") || ""));
  if (!month) {
    return NextResponse.json({ error: "חובה לבחור חודש" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const folderId = await ensureEmailInboxFolder(user.id);
  const docDate = new Date(year, month - 1, 15);

  const results: Array<
    | { ok: true; id: string; fileName: string }
    | { ok: false; fileName: string; error: string; docId?: string }
  > = [];

  for (const file of files) {
    if (!isAllowedFile(file)) {
      results.push({ ok: false, fileName: file.name, error: "סוג קובץ לא נתמך" });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileMime = file.type || "application/octet-stream";
      const metadata = await analyzeExpenseFile({
        buffer,
        mimeType: fileMime,
        fileName: file.name,
        fallbackDate: docDate,
      });
      const created = await createExpenseDocument({
        userId: user.id,
        expenseFolderId: folderId,
        buffer,
        fileName: file.name,
        fileMime,
        date: metadata.date,
        vendor: metadata.vendor,
        amount: metadata.amount,
        vatAmount: metadata.vatAmount,
        currency: metadata.currency,
      });

      if (!created.ok) {
        results.push({ ok: false, fileName: file.name, error: "duplicate", docId: created.docId });
        continue;
      }

      results.push({ ok: true, id: created.docId, fileName: file.name });
    } catch {
      results.push({ ok: false, fileName: file.name, error: "שגיאת העלאה" });
    }
  }

  revalidatePath("/receipts");
  const uploaded = results.filter((r) => r.ok).length;
  return NextResponse.json({ uploaded, total: files.length, results });
}
