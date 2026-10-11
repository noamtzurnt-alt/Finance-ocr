import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { createVaultItem, itemDataSchema, listVaultItems, ownsVaultFolder } from "@/app/lib/vault/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listVaultItems(user.id), { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = z
    .object({ data: itemDataSchema, folderId: z.string().max(64).nullable().optional() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const folderId = parsed.data.folderId || null;
  if (folderId && !(await ownsVaultFolder(folderId, user.id))) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const created = await createVaultItem(user.id, parsed.data.data, folderId);
  return NextResponse.json(created);
}
