import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { listFolders } from "@/app/lib/notes/server";

export const runtime = "nodejs";

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listFolders(user.id));
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "שם תיקייה לא תקין" }, { status: 400 });

  const f = await prisma.noteFolder.create({
    data: { userId: user.id, name: parsed.data.name },
    select: { id: true, name: true, createdAt: true },
  });
  return NextResponse.json({ id: f.id, name: f.name, createdAt: f.createdAt.toISOString() });
}
