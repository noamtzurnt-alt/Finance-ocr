import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { getDocumentsList } from "@/app/lib/receipts/list-documents";

const querySchema = z.object({
  q: z.string().optional(),
  type: z.enum(["expense", "income", "payment_receipt"]).optional(),
  categoryId: z.string().optional(),
  from: z.string().optional(), // YYYY-MM-DD
  to: z.string().optional(), // YYYY-MM-DD (inclusive)
  review: z.string().optional(), // "1" = only needsReview
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    review: url.searchParams.get("review") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const result = await getDocumentsList(user.id, {
    type: parsed.data.type,
    q: parsed.data.q,
    categoryId: parsed.data.categoryId,
    from: parsed.data.from,
    to: parsed.data.to,
    reviewOnly: parsed.data.review === "1",
    limit: Number(parsed.data.limit ?? "50") || 50,
    cursor: parsed.data.cursor,
  });

  return NextResponse.json(result);
}
