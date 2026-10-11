import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { listFields, toListDto } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

const createSchema = z.object({
  id: z.string().uuid().optional(),
  name: listFields.name,
  color: listFields.color.optional(),
  icon: listFields.icon.optional(),
  kind: listFields.kind.optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const last = await prisma.reminderList.findFirst({
    where: { userId: user.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const list = await prisma.reminderList.create({
    data: { ...parsed.data, userId: user.id, position: (last?.position ?? 0) + 1 },
  });
  return NextResponse.json(toListDto(list));
}
