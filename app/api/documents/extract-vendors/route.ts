import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { isGeminiConfigured } from "@/app/lib/gmail/gemini";
import { extractVendorFromStoredFile } from "@/app/lib/receipts/extract-vendor-from-file";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  /** If omitted, processes expenses whose vendor is still the placeholder. */
  ids: z.array(z.string().min(1).max(64)).max(50).optional(),
  onlyMissing: z.boolean().optional().default(true),
});

const PLACEHOLDER_VENDORS = new Set(["לא צוין", "לא מוכר", "unknown", "n/a", "-"]);

/**
 * Batch-extract supplier names from stored receipt files (PDF/image).
 * Processes sequentially to stay within Gemini free-tier rate limits.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "זיהוי ספק אוטומטי אינו מוגדר" }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const docs = await prisma.document.findMany({
    where: {
      userId: user.id,
      type: "expense",
      ...(parsed.data.ids?.length ? { id: { in: parsed.data.ids } } : {}),
    },
    select: { id: true, vendor: true, fileName: true, fileMime: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  const targets = docs.filter((d) => {
    if (parsed.data.ids?.length) return true;
    if (!parsed.data.onlyMissing) return true;
    const v = d.vendor.trim().toLowerCase();
    return !v || PLACEHOLDER_VENDORS.has(d.vendor.trim()) || PLACEHOLDER_VENDORS.has(v);
  });

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const results: Array<{ id: string; vendor?: string; error?: string }> = [];

  for (const doc of targets) {
    const mime = (doc.fileMime || "").toLowerCase();
    const name = doc.fileName.toLowerCase();
    if (mime.includes("html") || name.endsWith(".html")) {
      skipped += 1;
      results.push({ id: doc.id, error: "unsupported" });
      continue;
    }

    const result = await extractVendorFromStoredFile({ userId: user.id, documentId: doc.id });
    if (result.ok) {
      updated += 1;
      results.push({ id: doc.id, vendor: result.vendor });
    } else if (result.reason === "unsupported") {
      skipped += 1;
      results.push({ id: doc.id, error: result.reason });
    } else {
      failed += 1;
      results.push({ id: doc.id, error: result.reason });
    }
  }

  revalidatePath("/receipts");
  revalidatePath("/dashboard");

  return NextResponse.json({
    ok: true,
    scanned: targets.length,
    updated,
    failed,
    skipped,
    results,
  });
}
