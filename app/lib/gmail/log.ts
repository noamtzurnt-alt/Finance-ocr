import { prisma } from "@/app/lib/prisma";

export type EmailImportStatus =
  | "imported"
  | "contract_imported"
  | "skipped"
  | "duplicate"
  | "not_receipt"
  | "error";

type WriteEmailLogInput = {
  userId: string;
  gmailConnectionId: string;
  gmailMessageId: string;
  gmailAttachmentId?: string;
  status: EmailImportStatus;
  summary: string;
  detail?: unknown;
  documentId?: string | null;
  subject?: string | null;
  sender?: string | null;
  overwriteExisting?: boolean;
};

function safeDetail(detail: unknown): string | null {
  if (detail == null) return null;
  try {
    const raw = typeof detail === "string" ? detail : JSON.stringify(detail);
    return raw.length > 8000 ? `${raw.slice(0, 8000)}…` : raw;
  } catch {
    return String(detail).slice(0, 2000);
  }
}

export async function writeEmailImportLog(input: WriteEmailLogInput) {
  try {
    const attachmentId = input.gmailAttachmentId ?? "";
    const data = {
      userId: input.userId,
      gmailConnectionId: input.gmailConnectionId,
      gmailMessageId: input.gmailMessageId,
      gmailAttachmentId: attachmentId,
      status: input.status,
      summary: input.summary.slice(0, 500),
      detail: safeDetail(input.detail),
      documentId: input.documentId ?? null,
      subject: input.subject?.slice(0, 500) ?? null,
      sender: input.sender?.slice(0, 300) ?? null,
    };

    if (input.overwriteExisting) {
      await prisma.emailReceiptImport.upsert({
        where: {
          gmailConnectionId_gmailMessageId_gmailAttachmentId: {
            gmailConnectionId: input.gmailConnectionId,
            gmailMessageId: input.gmailMessageId,
            gmailAttachmentId: attachmentId,
          },
        },
        create: data,
        update: {
          status: data.status,
          summary: data.summary,
          detail: data.detail,
          documentId: data.documentId,
          subject: data.subject,
          sender: data.sender,
        },
      });
    } else {
      await prisma.emailReceiptImport.create({
        data,
      });
    }

    const keep = await prisma.emailReceiptImport.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true },
    });
    if (keep.length >= 200) {
      await prisma.emailReceiptImport.deleteMany({
        where: {
          userId: input.userId,
          id: { notIn: keep.map((k) => k.id) },
        },
      });
    }
  } catch (e) {
    console.error("[email import log]", e);
  }
}
