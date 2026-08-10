import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectReadUrl, objectExists } from "@/app/lib/r2/objects";

export const dynamic = "force-dynamic";

const NO_FILE_HTML = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>אין קובץ</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f5;color:#71717a;"><p>הקובץ לא נמצא.</p></body></html>`;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const showEmail = new URL(req.url).searchParams.get("file") === "email";
  const contract = await prisma.contract.findFirst({
    where: { id, userId: user.id },
    select: { fileKey: true, emailHtmlKey: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fileKey = showEmail ? contract.emailHtmlKey : contract.fileKey;
  if (!fileKey) return NextResponse.json({ error: "Email archive not found" }, { status: 404 });

  const exists = await objectExists(fileKey);
  if (!exists) {
    return new NextResponse(NO_FILE_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const url = await getObjectReadUrl(fileKey, 60 * 15);
  return NextResponse.redirect(url);
}
