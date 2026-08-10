import { prisma } from "@/app/lib/prisma";

export type MorningLogStatus =
  | "unauthorized"
  | "invalid_secret"
  | "ignored"
  | "skipped"
  | "imported"
  | "error"
  | "received";

type WriteMorningLogInput = {
  userId?: string | null;
  status: MorningLogStatus;
  httpStatus: number;
  summary: string;
  detail?: unknown;
  morningDocId?: string | null;
  morningType?: number | null;
  morningNumber?: string | number | null;
  documentId?: string | null;
};

function safeDetail(detail: unknown): string | null {
  if (detail == null) return null;
  try {
    const raw = typeof detail === "string" ? detail : JSON.stringify(detail, null, 0);
    return raw.length > 8000 ? `${raw.slice(0, 8000)}…` : raw;
  } catch {
    return String(detail).slice(0, 2000);
  }
}

/** Persist a Morning webhook diagnostic row (never throws). */
export async function writeMorningLog(input: WriteMorningLogInput) {
  try {
    await prisma.morningWebhookEvent.create({
      data: {
        userId: input.userId ?? null,
        status: input.status,
        httpStatus: input.httpStatus,
        summary: input.summary.slice(0, 500),
        detail: safeDetail(input.detail),
        morningDocId: input.morningDocId ?? null,
        morningType: input.morningType ?? null,
        morningNumber:
          input.morningNumber == null ? null : String(input.morningNumber).slice(0, 64),
        documentId: input.documentId ?? null,
      },
    });

    // Keep table small — drop oldest beyond 200 for this user (or global orphans)
    if (input.userId) {
      const keep = await prisma.morningWebhookEvent.findMany({
        where: { userId: input.userId },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true },
      });
      if (keep.length >= 200) {
        await prisma.morningWebhookEvent.deleteMany({
          where: {
            userId: input.userId,
            id: { notIn: keep.map((k) => k.id) },
          },
        });
      }
    }
  } catch (e) {
    console.error("[morning log] failed to persist", e);
  }

  const line = `[morning webhook] ${input.status} ${input.httpStatus}: ${input.summary}`;
  if (input.httpStatus >= 400 || input.status === "error") {
    console.error(line, input.detail ?? "");
  } else {
    console.info(line, input.detail ?? "");
  }
}
