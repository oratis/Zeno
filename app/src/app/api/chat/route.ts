import { runAgent } from "@/lib/agent/loop";
import { query } from "@/lib/db/client";

export const runtime = "nodejs"; // pg 需 Node 运行时
export const dynamic = "force-dynamic";

// POST /api/chat  body: { text: string, sessionId?: string }
// 返回 SSE 流：每行 `data: <StreamEvent JSON>\n\n`
export async function POST(req: Request) {
  const { text, sessionId: incoming } = await req.json().catch(() => ({}));
  if (!text || typeof text !== "string") {
    return new Response(JSON.stringify({ error: "missing text" }), { status: 400 });
  }

  const sessionId = incoming ?? (await createSession());

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ kind: "session", sessionId });
      try {
        for await (const ev of runAgent(text, sessionId)) send(ev);
      } catch (e) {
        send({ kind: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function createSession(): Promise<string> {
  try {
    const rows = await query<{ session_id: string }>(
      `INSERT INTO sessions (market) VALUES ($1) RETURNING session_id`,
      [process.env.ZENO_MARKET ?? "US"],
    );
    return rows[0].session_id;
  } catch {
    return "00000000-0000-0000-0000-000000000000"; // DB 不可用时的占位，便于无库联调
  }
}
