import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { bookmarkJson, getBookmark } from "@/lib/bookmarks";
import { pruneEmptyAiCategories } from "@/lib/categories";
import { getRequestUserId } from "@/lib/session";

/** Processing status of one bookmark, polled by the extension after saving. */
export async function GET(req: Request, ctx: RouteContext<"/api/bookmarks/[id]">) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await getBookmark(userId, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bookmarkJson(row));
}

/** Removes a bookmark (the extension's Undo / Remove). */
export async function DELETE(req: Request, ctx: RouteContext<"/api/bookmarks/[id]">) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await getBookmark(userId, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(schema.bookmark).where(and(eq(schema.bookmark.id, id), eq(schema.bookmark.userId, userId)));
  await pruneEmptyAiCategories(userId);
  return new NextResponse(null, { status: 204 });
}
