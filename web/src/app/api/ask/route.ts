import { streamAnswer } from "@/lib/ai";
import { findSources } from "@/lib/ask";
import { TYPE_LABEL } from "@/lib/format";
import { getRequestUserId } from "@/lib/session";

/**
 * Answers a question from the user's bookmarks. The response is newline-delimited JSON:
 * one `sources` line, then `text` chunks as the answer streams, then `done` (or `error`).
 */
export async function POST(req: Request) {
  const userId = await getRequestUserId(req);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (question.length < 3) return Response.json({ error: "Ask a question about what you've saved." }, { status: 400 });

  let sources;
  try {
    sources = await findSources(userId, question);
  } catch (err) {
    console.error("[ask] retrieval failed", err);
    return Response.json({ error: "Your library can't be searched right now." }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      send({
        type: "sources",
        sources: sources.map((s, i) => ({
          n: i + 1,
          id: s.id,
          url: s.url,
          type: s.type,
          title: s.title,
          site: s.site,
          categoryName: s.categoryName,
          categoryColor: s.categoryColor,
        })),
      });

      if (!sources.length) {
        send({ type: "done" });
        controller.close();
        return;
      }

      try {
        const result = streamAnswer(
          question,
          sources.map((s) => ({
            title: s.title,
            kind: [TYPE_LABEL[s.type], s.type === "web" ? s.site : s.author].filter(Boolean).join(", "),
            savedOn: s.createdAt.toISOString().slice(0, 10),
            summary: s.summary,
            keyPoints: s.keyPoints,
            highlight: s.note,
            tags: s.tags,
          })),
          req.signal,
        );
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") send({ type: "text", text: part.text });
          else if (part.type === "error") throw part.error;
        }
        send({ type: "done" });
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("[ask] answer failed", err);
          send({ type: "error", message: "The answer couldn't be written. Try asking again." });
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
