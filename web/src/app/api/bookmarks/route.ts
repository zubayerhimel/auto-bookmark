import { after, NextResponse } from "next/server";
import { parseSaveInput, saveBookmark } from "@/lib/bookmarks";
import { processBookmarks } from "@/lib/pipeline";
import { getRequestUserId } from "@/lib/session";

export const maxDuration = 300;

/** Save a bookmark. Called by the browser extension (Bearer token) or the web app (session). */
export async function POST(req: Request) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Sign in again to save bookmarks." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const input = parseSaveInput(body);
    const saved = await saveBookmark(userId, input);
    after(() => processBookmarks([saved.id]));
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save this link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
