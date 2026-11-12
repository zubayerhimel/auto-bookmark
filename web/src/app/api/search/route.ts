import { NextResponse } from "next/server";
import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { searchBookmarks } from "@/lib/search";
import { BOOKMARK_KINDS } from "@/lib/search-params";
import { getRequestUserId } from "@/lib/session";

const loadParams = createLoader({
  q: parseAsString.withDefault(""),
  type: parseAsStringLiteral(BOOKMARK_KINDS),
  category: parseAsString,
});

export async function GET(req: Request) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { q, type, category } = loadParams(req);
  try {
    const result = await searchBookmarks(userId, q, { categoryId: category, type });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
