import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { putObject } from "@/app/lib/r2/objects";
import { isContractFile } from "@/app/lib/contracts/files";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.contract.findMany({
    where: { userId: user.id },
    orderBy: [{ clientName: "asc" }, { contractDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      clientName: true,
      clientEmail: true,
      contractDate: true,
      details: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      emailHtmlKey: true,
      gmailMessageId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    items.map((c) => ({
      ...c,
      hasEmailHtml: Boolean(c.emailHtmlKey),
      importedFromGmail: Boolean(c.gmailMessageId),
      emailHtmlKey: undefined,
      gmailMessageId: undefined,
      contractDate: c.contractDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim() || null;
  const dateRaw = String(formData.get("contractDate") ?? "").trim();
  const file = formData.get("file");

  if (!clientName) {
    return NextResponse.json({ error: "שם לקוח חובה" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "יש לצרף קובץ חוזה" }, { status: 400 });
  }
  if (!isContractFile(file)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך — רק תמונה או PDF" }, { status: 400 });
  }

  const contractDate = dateRaw ? new Date(dateRaw) : null;
  if (dateRaw && Number.isNaN(contractDate?.getTime())) {
    return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileKey = `${user.id}/contracts/${Date.now()}-${file.name}`;
  await putObject({
    key: fileKey,
    body: buffer,
    contentType: file.type || "application/octet-stream",
  });

  const created = await prisma.contract.create({
    data: {
      userId: user.id,
      clientName,
      contractDate,
      details,
      fileKey,
      fileName: file.name,
      fileMime: file.type || "application/octet-stream",
      fileSize: file.size,
    },
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
    ...created,
    contractDate: created.contractDate?.toISOString() ?? null,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
}
