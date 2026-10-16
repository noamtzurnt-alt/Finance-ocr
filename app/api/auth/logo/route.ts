import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { deleteObject, getObjectReadUrl, putObject } from "@/app/lib/r2/objects";
export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסר קובץ תמונה" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "רק PNG / JPG / WEBP / GIF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 2MB)" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { logoKey: true },
  });

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const logoKey = `${user.id}/brand/logo-${Date.now()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  await putObject({ key: logoKey, body: buffer, contentType: file.type });

  if (existing?.logoKey && existing.logoKey !== logoKey) {
    try {
      await deleteObject(existing.logoKey);
    } catch {
      // ignore cleanup errors
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { logoKey },
    select: { id: true },
  });

  const logoUrl = await getObjectReadUrl(logoKey, 60 * 60);
  return NextResponse.json({ ok: true, logoUrl });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { logoKey: true },
  });
  if (existing?.logoKey) {
    try {
      await deleteObject(existing.logoKey);
    } catch {
      // ignore
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { logoKey: null },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
