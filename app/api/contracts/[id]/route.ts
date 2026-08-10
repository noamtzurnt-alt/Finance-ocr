import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { deleteObject, putObject } from "@/app/lib/r2/objects";
import { isContractFile } from "@/app/lib/contracts/files";

const patchSchema = z.object({
  clientName: z.string().trim().min(1).max(120).optional(),
  contractDate: z.string().nullable().optional(),
  details: z.string().max(5000).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.contract.findFirst({
    where: { id, userId: user.id },
    select: { id: true, fileKey: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const clientName = formData.has("clientName")
      ? String(formData.get("clientName") ?? "").trim()
      : undefined;
    const details = formData.has("details")
      ? String(formData.get("details") ?? "").trim() || null
      : undefined;
    const dateRaw = formData.has("contractDate")
      ? String(formData.get("contractDate") ?? "").trim()
      : undefined;
    const file = formData.get("file");

    const data: {
      clientName?: string;
      details?: string | null;
      contractDate?: Date | null;
      fileKey?: string;
      fileName?: string;
      fileMime?: string;
      fileSize?: number;
    } = {};

    if (clientName !== undefined) {
      if (!clientName) return NextResponse.json({ error: "שם לקוח חובה" }, { status: 400 });
      data.clientName = clientName;
    }
    if (details !== undefined) data.details = details;
    if (dateRaw !== undefined) {
      data.contractDate = dateRaw ? new Date(dateRaw) : null;
      if (dateRaw && Number.isNaN(data.contractDate?.getTime())) {
        return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
      }
    }

    if (file instanceof File && file.size > 0) {
      if (!isContractFile(file)) {
        return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileKey = `${user.id}/contracts/${Date.now()}-${file.name}`;
      await putObject({
        key: fileKey,
        body: buffer,
        contentType: file.type || "application/octet-stream",
      });
      await deleteObject(existing.fileKey);
      data.fileKey = fileKey;
      data.fileName = file.name;
      data.fileMime = file.type || "application/octet-stream";
      data.fileSize = file.size;
    }

    const updated = await prisma.contract.update({
      where: { id },
      data,
      select: {
        id: true,
        clientName: true,
        contractDate: true,
        details: true,
        fileName: true,
        fileMime: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ...updated,
      contractDate: updated.contractDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: {
    clientName?: string;
    details?: string | null;
    contractDate?: Date | null;
  } = {};
  if (parsed.data.clientName !== undefined) data.clientName = parsed.data.clientName;
  if (parsed.data.details !== undefined) data.details = parsed.data.details;
  if (parsed.data.contractDate !== undefined) {
    data.contractDate = parsed.data.contractDate ? new Date(parsed.data.contractDate) : null;
  }

  const updated = await prisma.contract.update({
    where: { id },
    data,
    select: {
      id: true,
      clientName: true,
      contractDate: true,
      details: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ...updated,
    contractDate: updated.contractDate?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.contract.findFirst({
    where: { id, userId: user.id },
    select: { fileKey: true, emailHtmlKey: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await Promise.allSettled([
    deleteObject(existing.fileKey),
    ...(existing.emailHtmlKey ? [deleteObject(existing.emailHtmlKey)] : []),
  ]);
  await prisma.contract.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
