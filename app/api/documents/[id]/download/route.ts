import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectBytes, objectExists } from "@/app/lib/r2/objects";

export const dynamic = "force-dynamic";

function safeFileName(name: string) {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "document";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    select: { fileKey: true, fileName: true, fileMime: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const exists = await objectExists(doc.fileKey);
  if (!exists) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const bytes = await getObjectBytes(doc.fileKey);
  if (!bytes) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const fileName = safeFileName(doc.fileName);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": doc.fileMime || "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "cache-control": "private, no-store",
    },
  });
}
