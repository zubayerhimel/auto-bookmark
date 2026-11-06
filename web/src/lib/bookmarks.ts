import "server-only";
import { and, desc, eq, isNull, lt, ne, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BookmarkType } from "@/db/schema";
import { clip, detectType, extractFromHtml, normalizeUrl } from "./extract";

export type SaveInput = {
  url: string;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  siteName?: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
  content?: string | null;
  html?: string | null;
  note?: string | null;
};

function str(value: unknown, max = 2000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/** Validates loosely-typed JSON (from the extension) into a SaveInput. */
export function parseSaveInput(body: unknown): SaveInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const url = str(b.url, 4000);
  if (!url) throw new Error("A url is required.");
  return {
    url,
    title: str(b.title, 500),
    description: str(b.description, 2000),
    author: str(b.author, 300),
    siteName: str(b.siteName, 200),
    imageUrl: str(b.imageUrl, 2000),
    publishedAt: str(b.publishedAt, 100),
    content: typeof b.content === "string" ? b.content : null,
    html: typeof b.html === "string" ? b.html.slice(0, 3_000_000) : null,
    note: str(b.note, 5000),
  };
}

/** Creates the bookmark (or refreshes it if this URL was saved before) and marks it for AI processing. */
export async function saveBookmark(userId: string, input: SaveInput) {
  const url = normalizeUrl(input.url);
  const type: BookmarkType = detectType(url);

  let fromHtml: ReturnType<typeof extractFromHtml> | null = null;
  if (input.html && type === "web") {
    try {
      fromHtml = extractFromHtml(url, input.html);
    } catch {
      fromHtml = null;
    }
  }

  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : fromHtml?.publishedAt;
  const content = clip(
    (fromHtml?.content?.length ?? 0) > (input.content?.length ?? 0) ? fromHtml?.content : input.content,
  );

  const values = {
    userId,
    url,
    type,
    title: input.title ?? fromHtml?.title ?? null,
    description: input.description ?? fromHtml?.description ?? null,
    author: input.author ?? fromHtml?.author ?? null,
    siteName: input.siteName ?? fromHtml?.siteName ?? null,
    imageUrl: input.imageUrl ?? fromHtml?.imageUrl ?? null,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    content,
    note: input.note ?? null,
    status: "pending" as const,
  };

  const [row] = await db
    .insert(schema.bookmark)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.bookmark.userId, schema.bookmark.url],
      set: {
        title: sql`coalesce(excluded.title, ${schema.bookmark.title})`,
        description: sql`coalesce(excluded.description, ${schema.bookmark.description})`,
        author: sql`coalesce(excluded.author, ${schema.bookmark.author})`,
        siteName: sql`coalesce(excluded.site_name, ${schema.bookmark.siteName})`,
        imageUrl: sql`coalesce(excluded.image_url, ${schema.bookmark.imageUrl})`,
        publishedAt: sql`coalesce(excluded.published_at, ${schema.bookmark.publishedAt})`,
        content: sql`coalesce(excluded.content, ${schema.bookmark.content})`,
        note: sql`coalesce(excluded.note, ${schema.bookmark.note})`,
        status: "pending",
        error: null,
        createdAt: sql`now()`,
      },
    })
    .returning({ id: schema.bookmark.id, status: schema.bookmark.status, url: schema.bookmark.url });
  return row;
}

// ---------- Reads ----------

export const listFields = {
  id: schema.bookmark.id,
  url: schema.bookmark.url,
  type: schema.bookmark.type,
  title: schema.bookmark.title,
  summary: schema.bookmark.summary,
  description: schema.bookmark.description,
  tags: schema.bookmark.tags,
  author: schema.bookmark.author,
  siteName: schema.bookmark.siteName,
  imageUrl: schema.bookmark.imageUrl,
  status: schema.bookmark.status,
  error: schema.bookmark.error,
  createdAt: schema.bookmark.createdAt,
  categoryId: schema.category.id,
  categoryName: schema.category.name,
  categorySlug: schema.category.slug,
  categoryColor: schema.category.color,
};

export type BookmarkListItem = {
  id: string;
  url: string;
  type: BookmarkType;
  title: string | null;
  summary: string | null;
  description: string | null;
  tags: string[];
  author: string | null;
  siteName: string | null;
  imageUrl: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  error: string | null;
  createdAt: Date;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryColor: string | null;
};

export const PAGE_SIZE = 40;

export async function listBookmarks(
  userId: string,
  opts: { categoryId?: string | null; uncategorized?: boolean; type?: BookmarkType; before?: Date } = {},
): Promise<BookmarkListItem[]> {
  const conds: SQL[] = [eq(schema.bookmark.userId, userId)];
  if (opts.categoryId) conds.push(eq(schema.bookmark.categoryId, opts.categoryId));
  if (opts.uncategorized) conds.push(isNull(schema.bookmark.categoryId));
  if (opts.type) conds.push(eq(schema.bookmark.type, opts.type));
  if (opts.before) conds.push(lt(schema.bookmark.createdAt, opts.before));
  return db
    .select(listFields)
    .from(schema.bookmark)
    .leftJoin(schema.category, eq(schema.category.id, schema.bookmark.categoryId))
    .where(and(...conds))
    .orderBy(desc(schema.bookmark.createdAt))
    .limit(PAGE_SIZE);
}

export async function getBookmark(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({
      bookmark: schema.bookmark,
      category: schema.category,
    })
    .from(schema.bookmark)
    .leftJoin(schema.category, eq(schema.category.id, schema.bookmark.categoryId))
    .where(and(eq(schema.bookmark.userId, userId), eq(schema.bookmark.id, id)))
    .limit(1);
  return row ?? null;
}

/** Nearest neighbours by meaning, for the "related" list on a bookmark. */
export async function relatedBookmarks(userId: string, id: string, limit = 5) {
  const [source] = await db
    .select({ embedding: schema.bookmark.embedding })
    .from(schema.bookmark)
    .where(and(eq(schema.bookmark.id, id), eq(schema.bookmark.userId, userId)))
    .limit(1);
  if (!source?.embedding) return [];
  const vec = JSON.stringify(source.embedding);
  return db
    .select(listFields)
    .from(schema.bookmark)
    .leftJoin(schema.category, eq(schema.category.id, schema.bookmark.categoryId))
    .where(
      and(
        eq(schema.bookmark.userId, userId),
        ne(schema.bookmark.id, id),
        sql`${schema.bookmark.embedding} is not null`,
      ),
    )
    .orderBy(sql`${schema.bookmark.embedding} <=> ${vec}::vector`)
    .limit(limit);
}

export async function listCategoriesWithCounts(userId: string) {
  return db
    .select({
      id: schema.category.id,
      name: schema.category.name,
      slug: schema.category.slug,
      description: schema.category.description,
      color: schema.category.color,
      source: schema.category.source,
      count: sql<number>`count(${schema.bookmark.id})::int`,
    })
    .from(schema.category)
    .leftJoin(schema.bookmark, eq(schema.bookmark.categoryId, schema.category.id))
    .where(eq(schema.category.userId, userId))
    .groupBy(schema.category.id)
    .orderBy(schema.category.name);
}

export async function libraryStats(userId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      uncategorized: sql<number>`count(*) filter (where ${schema.bookmark.categoryId} is null)::int`,
      busy: sql<number>`count(*) filter (where ${schema.bookmark.status} in ('pending','processing'))::int`,
    })
    .from(schema.bookmark)
    .where(eq(schema.bookmark.userId, userId));
  return row;
}
