import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function sse(data: unknown, event = "changed") {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

type Entity = "document" | "category" | "budget" | "contract" | "transaction" | "investment";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  // IMPORTANT: Keep DB usage light. This endpoint is long-lived and runs in a loop.
  // Default to a "core" watch (documents + transactions). Other entities can be enabled via ?full=1.
  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "1";

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  let streamClosed = false;
  const write = async (chunk: string) => {
    if (streamClosed) return;
    try {
      await writer.write(encoder.encode(chunk));
    } catch {
      streamClosed = true;
    }
  };

  const signal = req.signal;
  signal.addEventListener("abort", () => {
    streamClosed = true;
  });

  let last = new Date();
  try {
    await write(sse({ ok: true }, "hello"));
  } catch {
    streamClosed = true;
  }
  try {
    while (!signal.aborted && !streamClosed) {
      // Keep-alive: SSE comment every loop (4s) so Vercel/proxies don't close the connection
      await write(`: ping\n\n`);

      const candidates: Array<{ entity: Entity; id: string; at: Date; extra?: unknown }> = [];

      const doc = await prisma.document.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (doc) candidates.push({ entity: "document", id: doc.id, at: doc.updatedAt });

      const tx = await prisma.transaction.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (tx) candidates.push({ entity: "transaction", id: tx.id, at: tx.updatedAt });

      if (full) {
        const cat = await prisma.category.findFirst({
          where: { userId: user.id, updatedAt: { gt: last } },
          orderBy: { updatedAt: "asc" },
          select: { id: true, updatedAt: true },
        });
        if (cat) candidates.push({ entity: "category", id: cat.id, at: cat.updatedAt });

        const bud = await prisma.budget.findFirst({
          where: { userId: user.id, updatedAt: { gt: last } },
          orderBy: { updatedAt: "asc" },
          select: { id: true, updatedAt: true },
        });
        if (bud) candidates.push({ entity: "budget", id: bud.id, at: bud.updatedAt });

        const contract = await prisma.contract.findFirst({
          where: { userId: user.id, updatedAt: { gt: last } },
          orderBy: { updatedAt: "asc" },
          select: { id: true, updatedAt: true },
        });
        if (contract) candidates.push({ entity: "contract", id: contract.id, at: contract.updatedAt });

        const invAcc = await prisma.investmentAccount.findFirst({
          where: { userId: user.id, updatedAt: { gt: last } },
          orderBy: { updatedAt: "asc" },
          select: { id: true, updatedAt: true },
        });
        if (invAcc) candidates.push({ entity: "investment", id: invAcc.id, at: invAcc.updatedAt });

        const invYear = await prisma.investmentYear.findFirst({
          where: { userId: user.id, updatedAt: { gt: last } },
          orderBy: { updatedAt: "asc" },
          select: { id: true, updatedAt: true },
        });
        if (invYear) candidates.push({ entity: "investment", id: invYear.id, at: invYear.updatedAt });

        const invEntry = await prisma.investmentEntry.findFirst({
          where: { userId: user.id, updatedAt: { gt: last } },
          orderBy: { updatedAt: "asc" },
          select: { id: true, updatedAt: true },
        });
        if (invEntry) candidates.push({ entity: "investment", id: invEntry.id, at: invEntry.updatedAt });
      }

      if (candidates.length) {
        candidates.sort((a, b) => a.at.getTime() - b.at.getTime());
        const c = candidates[0]!;
        last = new Date(c.at.getTime() + 1);
        await write(sse({ entity: c.entity, id: c.id, updatedAt: c.at.toISOString(), ...((c.extra as object) ?? {}) }, "changed"));
      }

      await sleep(full ? 1500 : 4000);
    }
  } catch {
    streamClosed = true;
  } finally {
    try {
      await writer.close();
    } catch {
      // ignore
    }
  }

  return new Response(stream.readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

