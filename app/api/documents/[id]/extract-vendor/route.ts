import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { isGeminiConfigured } from "@/app/lib/gmail/gemini";
import { extractVendorFromStoredFile } from "@/app/lib/receipts/extract-vendor-from-file";

export const dynamic = "force-dynamic";

/** Re-read a stored receipt and extract supplier, date and missing amounts. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "זיהוי ספק אוטומטי אינו מוגדר" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await extractVendorFromStoredFile({ userId: user.id, documentId: id });

  if (!result.ok) {
    const messages = {
      not_found: "Not found",
      file_missing: "File not found",
      unsupported: "סוג הקובץ אינו נתמך לזיהוי (למשל HTML ממייל)",
      no_vendor: "לא הצלחנו לזהות ספק מתוך הקובץ",
    } as const;
    const status = result.reason === "not_found" || result.reason === "file_missing" ? 404 : 422;
    return NextResponse.json({ error: messages[result.reason] }, { status });
  }

  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    select: { expenseFolderId: true },
  });
  revalidatePath("/receipts");
  if (doc?.expenseFolderId) revalidatePath(`/receipts/folder/${doc.expenseFolderId}`);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, vendor: result.vendor, date: result.date });
}
