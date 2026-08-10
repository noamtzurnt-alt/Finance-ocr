import { NextResponse } from "next/server";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { putObject } from "@/app/lib/r2/objects";
import { writeMorningLog } from "@/app/lib/morning/log";
import {
  MORNING_RECEIPT_TYPES,
  downloadMorningPdf,
  extractMorningDocument,
  morningFileName,
  morningTypeLabel,
  verifyMorningWebhookSecret,
  type MorningDocumentPayload,
} from "@/app/lib/morning/webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Morning webhook — POST document/created events here with ?token=…&secret=…",
  });
}

async function parseBody(req: Request): Promise<{ raw: string; body: unknown; contentType: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  const raw = await req.text();

  if (contentType.includes("application/json") || raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    try {
      return { raw, body: JSON.parse(raw), contentType };
    } catch {
      return { raw, body: null, contentType };
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const out: Record<string, string> = {};
    params.forEach((v, k) => {
      out[k] = v;
    });
    for (const key of ["payload", "data", "body", "document", "json"]) {
      if (out[key]) {
        try {
          return { raw, body: JSON.parse(out[key]!), contentType };
        } catch {
          // continue
        }
      }
    }
    return { raw, body: out, contentType };
  }

  try {
    return { raw, body: JSON.parse(raw), contentType };
  } catch {
    return { raw, body: { raw }, contentType };
  }
}

function parseDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function docMeta(doc: MorningDocumentPayload | null) {
  if (!doc) return {};
  return {
    morningDocId: doc.id ?? null,
    morningType: doc.type != null ? Number(doc.type) : null,
    morningNumber: doc.number ?? null,
  };
}

function summarizeBody(body: unknown) {
  if (!body || typeof body !== "object") return { kind: typeof body };
  const obj = body as Record<string, unknown>;
  return {
    keys: Object.keys(obj).slice(0, 20),
    type: obj.type ?? (obj.data as { type?: unknown } | undefined)?.type,
    id: obj.id ?? (obj.data as { id?: unknown } | undefined)?.id,
    number: obj.number ?? (obj.data as { number?: unknown } | undefined)?.number,
  };
}

async function importMorningReceipt(userId: string, doc: MorningDocumentPayload) {
  const type = Number(doc.type);
  if (!MORNING_RECEIPT_TYPES.has(type)) {
    return {
      skipped: true as const,
      reason: `המסמך שהופק הוא "${morningTypeLabel(type)}" — נקלטות רק קבלות: קבלה, קבלה על תרומה, חשבונית מס/קבלה`,
      code: "wrong_type",
    };
  }

  const fileName = morningFileName(doc);
  const existing = await prisma.document.findFirst({
    where: { userId, fileName },
    select: { id: true },
  });
  if (existing) {
    return {
      skipped: true as const,
      reason: "מסמך כבר קיים במערכת (אותו מזהה Morning)",
      code: "duplicate",
      docId: existing.id,
    };
  }

  const downloadUrl =
    doc.files?.downloadLinks?.he || doc.files?.downloadLinks?.origin || doc.files?.downloadLinks?.en;
  if (!downloadUrl) {
    return {
      skipped: true as const,
      reason: "אין קישור להורדת PDF ב־payload של Morning",
      code: "no_download_link",
    };
  }

  let buffer: Buffer;
  let contentType: string;
  try {
    ({ buffer, contentType } = await downloadMorningPdf(downloadUrl));
  } catch (e) {
    return {
      skipped: false as const,
      error: true as const,
      reason: `הורדת PDF מ־Morning נכשלה: ${e instanceof Error ? e.message : String(e)}`,
      code: "pdf_download_failed",
    };
  }

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  const byHash = await prisma.document.findFirst({
    where: { userId, sha256: hash },
    select: { id: true },
  });
  if (byHash) {
    return {
      skipped: true as const,
      reason: "קובץ זהה כבר קיים (אותו hash)",
      code: "duplicate_hash",
      docId: byHash.id,
    };
  }

  const fileKey = `${userId}/morning/${Date.now()}-${fileName}`;
  try {
    await putObject({
      key: fileKey,
      body: buffer,
      contentType: contentType.includes("pdf") ? "application/pdf" : contentType,
    });
  } catch (e) {
    return {
      skipped: false as const,
      error: true as const,
      reason: `שמירה ל־R2 נכשלה: ${e instanceof Error ? e.message : String(e)}`,
      code: "r2_failed",
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { vatPercent: true },
  });
  const vatPct = dbUser?.vatPercent.toNumber() ?? 18;
  const total = Number(doc.total ?? 0);
  const vatAmount = total > 0 ? total * (vatPct / (100 + vatPct)) : 0;
  const preVatAmount = total - vatAmount;

  const created = await prisma.document.create({
    data: {
      userId,
      type: "payment_receipt",
      date: parseDate(doc.date),
      amount: Math.round(total * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      preVatAmount: Math.round(preVatAmount * 100) / 100,
      vendor: (doc.recipient?.name || "לקוח Morning").slice(0, 200),
      description: doc.description?.slice(0, 2000) || null,
      docNumber: doc.number != null ? String(doc.number) : null,
      fileKey,
      fileName,
      fileMime: "application/pdf",
      fileSize: buffer.length,
      sha256: hash,
      currency: doc.currency === "USD" || doc.currency === "EUR" ? doc.currency : "ILS",
    },
    select: { id: true },
  });

  revalidatePath("/payment-receipts");
  revalidatePath("/dashboard");

  return { skipped: false as const, docId: created.id, code: "imported" as const };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim() || "";
  const querySecret = url.searchParams.get("secret")?.trim() || null;
  const hasSecretParam = Boolean(querySecret);

  if (!token) {
    await writeMorningLog({
      status: "unauthorized",
      httpStatus: 401,
      summary: "חסר token בכתובת ה־URL",
      detail: { hasSecretParam, path: url.pathname },
    });
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { morningWebhookToken: token, approved: true },
    select: { id: true, morningWebhookSecret: true },
  });
  if (!user) {
    await writeMorningLog({
      status: "unauthorized",
      httpStatus: 401,
      summary: "token לא מזוהה / משתמש לא מאושר",
      detail: { tokenPrefix: token.slice(0, 8), hasSecretParam },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw = "";
  let body: unknown = null;
  let contentType = "";
  try {
    ({ raw, body, contentType } = await parseBody(req));
  } catch (e) {
    await writeMorningLog({
      userId: user.id,
      status: "error",
      httpStatus: 400,
      summary: "נכשל בקריאת גוף הבקשה",
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  // Fail closed: webhook without a configured secret must not accept traffic.
  if (!user.morningWebhookSecret) {
    await writeMorningLog({
      userId: user.id,
      status: "invalid_secret",
      httpStatus: 401,
      summary: "אין Secret מוגדר למשתמש — הפעל מחדש את האינטגרציה בהגדרות",
      detail: { hasSecretParam, contentType },
    });
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
  }

  const ok = verifyMorningWebhookSecret({
    secret: user.morningWebhookSecret,
    querySecret,
    headers: req.headers,
    rawBody: raw,
  });
  if (!ok) {
    await writeMorningLog({
      userId: user.id,
      status: "invalid_secret",
      httpStatus: 401,
      summary: "Secret לא תואם — בדוק את ה־URL וה־Secret ב־Morning",
      detail: {
        hasSecretParam,
        contentType,
        headerKeys: [...req.headers.keys()].filter((h) =>
          /secret|sign|auth/i.test(h),
        ),
        bodyPreview: summarizeBody(body),
      },
    });
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  try {
    const doc = extractMorningDocument(body);
    if (!doc) {
      await writeMorningLog({
        userId: user.id,
        status: "ignored",
        httpStatus: 200,
        summary: "התקבלה בקשה בלי מסמך מזוהה — התעלמנו",
        detail: { contentType, bodyPreview: summarizeBody(body), rawLen: raw.length },
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    const meta = docMeta(doc);
    const result = await importMorningReceipt(user.id, doc);

    if ("error" in result && result.error) {
      await writeMorningLog({
        userId: user.id,
        status: "error",
        httpStatus: 500,
        summary: result.reason,
        detail: { code: result.code, ...meta },
        ...meta,
      });
      return NextResponse.json({ error: result.reason, code: result.code }, { status: 500 });
    }

    if (result.skipped) {
      await writeMorningLog({
        userId: user.id,
        status: "skipped",
        httpStatus: 200,
        summary: result.reason,
        detail: { code: result.code, docId: "docId" in result ? result.docId : undefined, ...meta },
        documentId: "docId" in result ? result.docId : null,
        ...meta,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    await writeMorningLog({
      userId: user.id,
      status: "imported",
      httpStatus: 200,
      summary: `קבלה נקלטה בהצלחה (#${doc.number ?? "?"} · ${doc.recipient?.name ?? "לקוח"})`,
      detail: {
        code: "imported",
        docId: result.docId,
        total: doc.total,
        currency: doc.currency,
        ...meta,
      },
      documentId: result.docId,
      ...meta,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await writeMorningLog({
      userId: user.id,
      status: "error",
      httpStatus: 500,
      summary: e instanceof Error ? e.message : "שגיאה לא צפויה ב־webhook",
      detail: { stack: e instanceof Error ? e.stack?.slice(0, 1500) : undefined },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 500 },
    );
  }
}
