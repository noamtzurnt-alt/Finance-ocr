import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";
import { putObject } from "@/app/lib/r2/objects";
import { formatQuickReply, parseQuickTransaction } from "@/app/lib/transactions/parse-quick";

export const runtime = "nodejs";

/** Twilio sends incoming messages with POST. GET is for health checks / browser; we respond so logs show 200 not 307. */
export async function GET() {
  return new NextResponse(
    JSON.stringify({ ok: true, message: "Webhook expects POST with Twilio incoming message body." }),
    { headers: { "Content-Type": "application/json" } },
  );
}

/** Normalize phone to E.164 for lookup. Twilio WhatsApp sends e.g. "whatsapp:+972501234567". */
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/^whatsapp:/i, "").trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 9) return "972" + digits.slice(1);
  if (digits.length >= 9) return "972" + digits.slice(-9);
  return digits;
}

/** Twilio sends application/x-www-form-urlencoded. Next.js formData() supports it. */
async function parseIncomingBody(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const out: Record<string, string> = {};
  form.forEach((v, k) => {
    out[k] = typeof v === "string" ? v : (v as File).name ?? "";
  });
  return out;
}

/** Fetch Twilio media URL with Basic auth (Account SID : Auth Token). */
async function fetchTwilioMedia(mediaUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set");

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Twilio media fetch failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { buffer, contentType };
}

function twimlMessage(text: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${escapeXml(text)}</Body></Message></Response>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: Request) {
  const body = await parseIncomingBody(req);
  const from = body.From ?? body.from ?? "";
  const messageBody = (body.Body ?? body.body ?? "").trim();
  const numMedia = parseInt(body.NumMedia ?? body.NumMedia ?? "0", 10);
  const mediaUrl = body.MediaUrl0 ?? body.MediaUrl0 ?? "";
  const mediaContentType = body.MediaContentType0 ?? body.MediaContentType0 ?? "image/jpeg";

  // Debug: log so you can see in Vercel/host logs if webhook received and what Twilio sent
  console.log("[webhooks/incoming] From=%s NumMedia=%s MediaUrl0=%s", from, numMedia, mediaUrl ? "yes" : "no");

  // 1) קודם לפי השולח (From): כשמשתמש שולח קבלה מהמספר שלו, היא נכנסת לחשבון שלו.
  const fromNormalized = normalizePhone(from);
  let user: { id: string; approved: boolean } | null = null;

  if (fromNormalized) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: fromNormalized },
          { phoneNumber: `+${fromNormalized}` },
        ],
      },
      select: { id: true, approved: true },
    });
  }

  // 2) אם לא מצאנו לפי השולח – לפי המספר שמקבל (To): כשהלקוח שולח למספר העסקי, נכנס למי שהגדיר את המספר הזה ב"מספר לקבלת קבלות".
  if (!user) {
    const toRaw = body.To ?? body.to ?? "";
    const toNormalized = normalizePhone(toRaw);
    if (toNormalized) {
      const matches = await prisma.user.findMany({
        where: {
          OR: [
            { whatsappIncomingNumber: toNormalized },
            { whatsappIncomingNumber: `+${toNormalized}` },
          ],
        },
        select: { id: true, approved: true },
      });
      if (matches.length === 1) user = matches[0]!;
      if (matches.length > 1) {
        // Prevent cross-account routing if multiple users configured the same Twilio number.
        return twimlMessage(
          "יש כמה חשבונות שמוגדרים עם אותו מספר WhatsApp לקבלת קבלות (Twilio). זה לא בטוח ולכן חסמתי את ההודעה. בקש מהאדמין לוודא שלכל עסק יש מספר Twilio ייחודי בהגדרות.",
        );
      }
    }
  }

  if (!user) {
    return twimlMessage("לא נמצא חשבון. אם אתה משתמש – הכנס את מספר הטלפון שלך בהגדרות (המספר שממנו אתה שולח). אם אתה לקוח – שלח למספר העסקי שהתקבל ממך.");
  }

  if (!user.approved) {
    return twimlMessage("החשבון שלך עדיין ממתין לאישור מנהל המערכת, ולכן WhatsApp עדיין לא פעיל עבורך.");
  }

  // If user replied with classification (no media), apply to the latest webhook doc and confirm.
  if (numMedia === 0 || !mediaUrl) {
    const t = messageBody.toLowerCase();
    const wantsPaymentReceipt = t === "1" || /קבלה על תשלום|קבלה.*תשלום|^קבלה$|payment.?receipt/i.test(messageBody);

    if (wantsPaymentReceipt) {
      const since = new Date(Date.now() - 20 * 60 * 1000);
      const latest = await prisma.document.findFirst({
        where: { userId: user.id, createdAt: { gte: since }, fileName: { startsWith: "webhook-" } },
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, type: true, createdAt: true },
      });

      if (!latest) {
        return twimlMessage("לא מצאתי מסמך אחרון שסיכמת. שלח קודם תמונה/קובץ ואז השב 1 כדי לסמן אותו כקבלה (הכנסה).");
      }

      await prisma.document.update({
        where: { id: latest.id },
        data: { type: "payment_receipt" },
        select: { id: true },
      });

      return twimlMessage("סבבה—סימנתי כקבלה (הכנסה).");
    }

    // Quick transaction (text-only): "משקה חלבון סכום 12 שקלים"
    const tx = parseQuickTransaction(messageBody);
    if (tx) {
      // Ensure we have a default category so it looks tidy in "תנועות".
      const defaultCategoryName = "כללי";
      const category =
        (await prisma.category.findFirst({
          where: { userId: user.id, name: defaultCategoryName },
          select: { id: true },
        })) ??
        (await prisma.category.create({
          data: { userId: user.id, name: defaultCategoryName },
          select: { id: true },
        }));

      const created = await prisma.transaction.create({
        data: {
          userId: user.id,
          date: new Date(),
          amount: tx.amount.toFixed(2),
          currency: tx.currency,
          vendor: tx.vendor,
          description: null,
          categoryId: category.id,
          cardLast4: null,
        },
        select: { id: true },
      });

      return twimlMessage(formatQuickReply(tx, created.id));
    }

    return twimlMessage(
      "אפשר:\n1) לשלוח תמונה/קובץ של קבלה (ואז לענות 1)\n2) להוסיף תנועה מהירה בטקסט:\nלדוגמה: משקה חלבון סכום 12 שקלים\nאו: משקה חלבון 12 ₪",
    );
  }

  try {
    const { buffer, contentType } = await fetchTwilioMedia(mediaUrl);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    const existing = await prisma.document.findFirst({
      where: { userId: user.id, sha256: hash },
      select: { id: true },
    });
    if (existing) {
      return twimlMessage("הקבלה הזו כבר נשמרה במערכת.");
    }

    const ext = contentType.includes("pdf") ? "pdf" : contentType.includes("png") ? "png" : "jpg";
    const fileName = `webhook-${Date.now()}.${ext}`;
    const fileKey = `${user.id}/${Date.now()}-${fileName}`;
    await putObject({ key: fileKey, body: new Uint8Array(buffer), contentType });

    const doc = await prisma.document.create({
      data: {
        userId: user.id,
        type: "expense",
        date: new Date(),
        amount: 0,
        vendor: "Unknown",
        categoryId: null,
        description: null,
        fileKey,
        fileName,
        fileMime: contentType,
        fileSize: buffer.length,
        sha256: hash,
      },
    });

    console.log("[webhooks/incoming] Doc created docId=%s userId=%s", doc.id, user.id);
    return twimlMessage(
      "קיבלתי את המסמך! היכנס לאפליקציה כדי למלא פרטים (ספק, סכום, תאריך).\nאם זו קבלה על תשלום שנכנס, השב 1.",
    );
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[webhooks/incoming]", err);
    return twimlMessage("אירעה שגיאה בעיבוד התמונה. נסה שוב או העלה מהאפליקציה.");
  }
}
