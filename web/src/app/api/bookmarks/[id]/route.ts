import { NextResponse } from "next/server";
import { getBookmark } from "@/lib/bookmarks";
import { getRequestUserId } from "@/lib/session";

/** Processing status of one bookmark, polled by the extension after saving. */
export async function GET(req: Request, ctx: RouteContext<"/api/bookmarks/[id]">) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await getBookmark(userId, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { bookmark: b, category } = row;
  return NextResponse.json({
    id: b.id,
    url: b.url,
    type: b.type,
    status: b.status,
    error: b.error,
    title: b.title,
    summary: b.summary,
    tags: b.tags,
    category: category ? { name: category.name, color: category.color } : null,
  });
}
