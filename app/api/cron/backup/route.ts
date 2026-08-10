/**
 * גיבוי אוטומטי ל־DB → R2.
 * ב־Supabase Free Plan אין גיבויים אוטומטיים של ה־Database, לכן ה־Cron קורא לנתיב הזה
 * (למשל פעם ביום) ומייצא snapshot של הנתונים ל־Cloudflare R2 בתיקייה backups/.
 * אימות: CRON_SECRET ב־Query (?secret=…) או ב־Header (Authorization: Bearer …).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { putObject } from "@/app/lib/r2/objects";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { "Content-Type": "application/json" } });
}

/** Serialize Prisma results: Decimal and Date to JSON-safe values. */
function serializeForBackup(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "number" || typeof obj === "boolean" || typeof obj === "string") return obj;
  if (obj instanceof Date) return obj.toISOString();
  const o = obj as Record<string, unknown>;
  if (typeof o === "object" && o !== null && typeof (o as { toFixed?: unknown }).toFixed === "function") {
    return String(o);
  }
  if (Array.isArray(o)) return o.map(serializeForBackup);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[k] = serializeForBackup(v);
  return out;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 500, headers: JSON_HEADERS });
  }

  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret") ?? "";
  if (auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: JSON_HEADERS });
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 19).replace(/[-:T]/g, ""); // YYYYMMDDHHmmss
  const key = `backups/db-snapshot-${dateStr}.json`;

  try {
    const [users, categories, documents, transactions, investmentAccounts, investmentYears, investmentEntries, budgets, contracts] =
      await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            whatsappIncomingNumber: true,
            businessType: true,
            businessName: true,
            taxId: true,
            vatPercent: true,
            isAdmin: true,
            approved: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.category.findMany(),
        prisma.document.findMany(),
        prisma.transaction.findMany(),
        prisma.investmentAccount.findMany(),
        prisma.investmentYear.findMany(),
        prisma.investmentEntry.findMany(),
        prisma.budget.findMany(),
        prisma.contract.findMany({
          select: {
            id: true,
            userId: true,
            clientName: true,
            contractDate: true,
            details: true,
            fileName: true,
            fileMime: true,
            fileSize: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ]);

    const snapshot = {
      exportedAt: now.toISOString(),
      version: 1,
      users,
      categories,
      documents,
      transactions,
      investmentAccounts,
      investmentYears,
      investmentEntries,
      budgets,
      contracts,
    };

    const json = JSON.stringify(serializeForBackup(snapshot), null, 0);
    const body = new TextEncoder().encode(json);

    await putObject({
      key,
      body,
      contentType: "application/json",
    });

    return NextResponse.json({ ok: true, key, size: body.byteLength }, { headers: JSON_HEADERS });
  } catch (e) {
    console.error("[cron/backup]", e);
    const message = e instanceof Error ? e.message : "Backup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSON_HEADERS });
  }
}
