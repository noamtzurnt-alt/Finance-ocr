import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { syncAllGmailForUser, syncGmailConnection } from "@/app/lib/gmail/sync";
import { CONTRACT_GMAIL_ACCOUNT } from "@/app/lib/contracts/email-import";
import { MORNING_RECEIPTS_GMAIL_ACCOUNT } from "@/app/lib/receipts/morning-email-import";

export const maxDuration = 120;

function inboxEmailForPurpose(purpose: string | undefined) {
  if (purpose === "contracts") return CONTRACT_GMAIL_ACCOUNT;
  if (purpose === "receipts") return MORNING_RECEIPTS_GMAIL_ACCOUNT;
  return null;
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await prisma.gmailConnection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      emailAddress: true,
      lastSyncAt: true,
      lastError: true,
      syncStatus: true,
      createdAt: true,
    },
  });

  const events = await prisma.emailReceiptImport.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      summary: true,
      detail: true,
      subject: true,
      sender: true,
      documentId: true,
      createdAt: true,
      gmailConnectionId: true,
    },
  });

  const configured = Boolean(
    process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() &&
      process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim(),
  );

  return NextResponse.json({ connections, events, configured });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = (await req.json().catch(() => null)) as {
    connectionId?: string;
    purpose?: "contracts" | "receipts";
  } | null;

  try {
    if (json?.connectionId) {
      const conn = await prisma.gmailConnection.findFirst({
        where: { id: json.connectionId, userId: user.id },
        select: { id: true },
      });
      if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const result = await syncGmailConnection(conn.id);
      return NextResponse.json({ ok: true, results: [result] });
    }

    const purposeEmail = inboxEmailForPurpose(json?.purpose);
    if (purposeEmail) {
      const conn = await prisma.gmailConnection.findFirst({
        where: {
          userId: user.id,
          emailAddress: { equals: purposeEmail, mode: "insensitive" },
        },
        select: { id: true, emailAddress: true },
      });
      if (!conn) {
        return NextResponse.json(
          {
            error:
              json?.purpose === "contracts"
                ? `לא מחובר חשבון ${CONTRACT_GMAIL_ACCOUNT} — חבר אותו בהגדרות`
                : `לא מחובר חשבון ${MORNING_RECEIPTS_GMAIL_ACCOUNT} — חבר אותו בהגדרות`,
          },
          { status: 404 },
        );
      }
      const result = await syncGmailConnection(conn.id);
      return NextResponse.json({ ok: true, results: [result] });
    }

    const results = await syncAllGmailForUser(user.id);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 },
    );
  }
}
