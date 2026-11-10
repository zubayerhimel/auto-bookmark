import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { hostOf, TYPE_LABEL } from "./format";
import { searchBookmarks } from "./search";

export const MAX_SOURCES = 8;

/** The bookmarks an answer may draw on, best match first. */
export async function findSources(userId: string, question: string) {
  const { results } = await searchBookmarks(userId, question);
  const ids = results
    .filter((r) => r.status === "ready")
    .slice(0, MAX_SOURCES)
    .map((r) => r.id);
  if (!ids.length) return [];

  const rows = await db
    .select({ bookmark: schema.bookmark, category: schema.category })
    .from(schema.bookmark)
    .leftJoin(schema.category, eq(schema.category.id, schema.bookmark.categoryId))
    .where(inArray(schema.bookmark.id, ids));
  const byId = new Map(rows.map((r) => [r.bookmark.id, r]));

  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const { bookmark: b, category } = row;
    const host = hostOf(b.url);
    return [
      {
        id: b.id,
        url: b.url,
        type: b.type,
        title: b.title || host,
        site: b.type === "web" ? (b.siteName ?? host) : TYPE_LABEL[b.type],
        author: b.author,
        createdAt: b.createdAt,
        categoryName: category?.name ?? null,
        categoryColor: category?.color ?? null,
        summary: b.summary ?? b.description,
        keyPoints: b.keyPoints ?? [],
        note: b.note,
        tags: b.tags,
      },
    ];
  });
}

export type AskSource = Awaited<ReturnType<typeof findSources>>[number];
