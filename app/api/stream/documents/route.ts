import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function sse(data: unknown, event = "message") {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const docId = url.searchParams.get("docId")?.trim() || null;

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

  // Start with current "watermark"
  let last = new Date();

  // Initial hello
  await write(sse({ ok: true, docId }, "hello"));
  try {
    while (!signal.aborted && !streamClosed) {
      // Keep-alive: SSE comment every 2s so Vercel/proxies don't close the connection
      await write(`: ping\n\n`);

      const where: { userId: string; id?: string; updatedAt: { gt: Date } } = docId
        ? { userId: user.id, id: docId, updatedAt: { gt: last } }
        : { userId: user.id, updatedAt: { gt: last } };

      const changed = await prisma.document.findFirst({
        where,
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });

      if (changed) {
        last = new Date(changed.updatedAt.getTime() + 1);
        await write(
          sse(
            {
              id: changed.id,
              updatedAt: changed.updatedAt.toISOString(),
            },
            "changed",
          ),
        );
      }

      await sleep(2000);
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

