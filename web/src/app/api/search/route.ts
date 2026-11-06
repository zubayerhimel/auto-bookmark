import { NextResponse } from "next/server";
import type { BookmarkType } from "@/db/schema";
import { searchBookmarks } from "@/lib/search";
import { getRequestUserId } from "@/lib/session";

const TYPES = new Set(["web", "tweet", "youtube"]);

export async function GET(req: Request) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const type = params.get("type");
  try {
    const result = await searchBookmarks(userId, q, {
      categoryId: params.get("category"),
      type: type && TYPES.has(type) ? (type as BookmarkType) : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
