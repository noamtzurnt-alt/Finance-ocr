import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { ownsList, toSectionDto } from "@/app/lib/reminders/server";

export const runtime = "nodejs";

const createSchema = z.object({
  id: z.string().uuid().optional(),
  listId: z.string().max(64),
  name: z.string().trim().min(1).max(80),
  position: z.number().optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (!(await ownsList(parsed.data.listId, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const section = await prisma.reminderSection.create({ data: { ...parsed.data, userId: user.id } });
  return NextResponse.json(toSectionDto(section));
}
