import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const conn = await prisma.gmailConnection.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.gmailConnection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
