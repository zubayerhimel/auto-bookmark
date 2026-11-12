import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BookmarkType } from "@/db/schema";
import { clip, detectType, extractFromHtml, normalizeUrl } from "./extract";
import type { LibrarySort } from "./search-params";

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
  readAt: schema.bookmark.readAt,
  categoryLocked: schema.bookmark.categoryLocked,
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
  readAt: Date | null;
  categoryLocked: boolean;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryColor: string | null;
};

export const PAGE_SIZE = 30;

/**
 * What a card shows as its title (the page title, else the site's host), lowercased and without
 * leading punctuation, so "[Draft] Notes" files under N and case doesn't matter.
 */
const titleKey = sql`regexp_replace(lower(coalesce(nullif(btrim(${schema.bookmark.title}), ''), regexp_replace(split_part(${schema.bookmark.url}, '/', 3), '^www[.]', ''))), '^[^[:alnum:]]+', '')`;

const SORT_KEYS: Record<LibrarySort, { key: SQL; type: "timestamp" | "text"; descending: boolean }> = {
  newest: { key: sql`${schema.bookmark.createdAt}`, type: "timestamp", descending: true },
  oldest: { key: sql`${schema.bookmark.createdAt}`, type: "timestamp", descending: false },
  title: { key: titleKey, type: "text", descending: false },
  "title-desc": { key: titleKey, type: "text", descending: true },
};

/*
 * Pages continue from a cursor (the last row's sort key and id) rather than an offset, so each page
 * costs the same however deep you scroll, and new saves arriving meanwhile don't shift what comes next.
 * The key travels as Postgres' own text form, which keeps microsecond timestamps exact.
 */
function encodeCursor(key: string, id: string) {
  return Buffer.from(JSON.stringify([key, id])).toString("base64url");
}

function decodeCursor(cursor: string): { key: string; id: string } | null {
  try {
    const [key, id] = JSON.parse(Buffer.from(cursor, "base64url").toString());
    return typeof key === "string" && typeof id === "string" && isUuid(id) ? { key, id } : null;
  } catch {
    return null;
  }
}

export type BookmarkPage = { items: BookmarkListItem[]; nextCursor: string | null };

export async function listBookmarks(
  userId: string,
  opts: {
    categoryId?: string | null;
    /** Filter by category slug without a separate lookup first, so it can run alongside one. */
    categorySlug?: string;
    uncategorized?: boolean;
    type?: BookmarkType;
    unread?: boolean;
    sort?: LibrarySort;
    /** From a previous page's `nextCursor`. */
    cursor?: string | null;
  } = {},
): Promise<BookmarkPage> {
  const conds: SQL[] = [eq(schema.bookmark.userId, userId)];
  if (opts.categoryId) conds.push(eq(schema.bookmark.categoryId, opts.categoryId));
  if (opts.categorySlug) {
    conds.push(
      sql`${schema.bookmark.categoryId} = (select c.id from category c where c.user_id = ${userId} and c.slug = ${opts.categorySlug})`,
    );
  }
  if (opts.uncategorized) conds.push(isNull(schema.bookmark.categoryId));
  if (opts.type) conds.push(eq(schema.bookmark.type, opts.type));
  if (opts.unread) conds.push(isNull(schema.bookmark.readAt));

  const { key, type, descending } = SORT_KEYS[opts.sort ?? "newest"];
  if (opts.cursor) {
    const after = decodeCursor(opts.cursor);
    if (!after) return { items: [], nextCursor: null };
    conds.push(
      sql`(${key}, ${schema.bookmark.id}) ${sql.raw(descending ? "<" : ">")} (${after.key}::${sql.raw(type)}, ${after.id}::uuid)`,
    );
  }
  const dir = descending ? desc : asc;
  const rows = await db
    .select({ ...listFields, sortKey: sql<string>`(${key})::text` })
    .from(schema.bookmark)
    .leftJoin(schema.category, eq(schema.category.id, schema.bookmark.categoryId))
    .where(and(...conds))
    .orderBy(dir(key), dir(schema.bookmark.id))
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  const nextCursor = rows.length > PAGE_SIZE && last ? encodeCursor(last.sortKey, last.id) : null;
  for (const row of page) delete (row as Partial<typeof row>).sortKey;
  return { items: page, nextCursor };
}

/** The list query for the library's URL filters. */
export function libraryQuery(params: {
  category: string | null;
  type: BookmarkType | null;
  view: "unread" | null;
  sort: LibrarySort;
}) {
  return {
    sort: params.sort,
    categorySlug: params.category && params.category !== "uncategorized" ? params.category : undefined,
    uncategorized: params.category === "uncategorized",
    type: params.type ?? undefined,
    unread: params.view === "unread",
  };
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function getBookmark(userId: string, id: string) {
  if (!isUuid(id)) return null;
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
/** The bookmark saved for this URL (after normalizing it), or null. */
export async function findBookmarkByUrl(userId: string, rawUrl: string) {
  let url: string;
  try {
    url = normalizeUrl(rawUrl);
  } catch {
    return null;
  }
  const [row] = await db
    .select({ bookmark: schema.bookmark, category: schema.category })
    .from(schema.bookmark)
    .leftJoin(schema.category, eq(schema.category.id, schema.bookmark.categoryId))
    .where(and(eq(schema.bookmark.userId, userId), eq(schema.bookmark.url, url)))
    .limit(1);
  return row ?? null;
}

/** The bookmark as the extension sees it. */
export function bookmarkJson({ bookmark: b, category }: NonNullable<Awaited<ReturnType<typeof getBookmark>>>) {
  return {
    id: b.id,
    url: b.url,
    type: b.type,
    status: b.status,
    error: b.error,
    title: b.title,
    summary: b.summary,
    tags: b.tags,
    createdAt: b.createdAt,
    category: category ? { name: category.name, color: category.color } : null,
  };
}

/**
 * Cosine distances for "Close in meaning", calibrated on text-embedding-3-small: unrelated
 * bookmarks sit around 0.6–0.8 apart, so nearness alone only counts when it is strong. A
 * moderate match also needs a shared category or a shared specific tag.
 */
const RELATED_ON_ITS_OWN = 0.55;
const RELATED_WITH_SHARED_TOPIC = 0.66;
/** Tags that name a platform rather than a topic, so sharing one says nothing. */
const PLATFORM_TAGS = ["x", "twitter", "tweet", "youtube", "video", "instagram", "facebook", "reddit", "article", "blog"];

/** Only bookmarks that are truly about the same thing, closest first; often fewer than `limit`, sometimes none. */
export async function relatedBookmarks(userId: string, id: string, limit = 5) {
  if (!isUuid(id)) return [];
  // The source is read in the same statement, so this is one round trip to the database.
  const source = (column: SQL) => sql`(select ${column} from bookmark s where s.id = ${id} and s.user_id = ${userId})`;
  const distance = sql`(${schema.bookmark.embedding} <=> ${source(sql`s.embedding`)})`;
  const sameCategory = sql`coalesce(${schema.bookmark.categoryId} = ${source(sql`s.category_id`)}, false)`;
  const sharedTag = sql`exists (
    select 1 from unnest(${schema.bookmark.tags}) t
    where lower(t) in ${source(sql`lower(unnest(s.tags))`)}
      and lower(t) not in (${sql.join(PLATFORM_TAGS.map((t) => sql`${t}`), sql`, `)})
  )`;
  return db
    .select(listFields)
    .from(schema.bookmark)
    .leftJoin(schema.category, eq(schema.category.id, schema.bookmark.categoryId))
    .where(
      and(
        eq(schema.bookmark.userId, userId),
        ne(schema.bookmark.id, id),
        sql`${schema.bookmark.embedding} is not null`,
        sql`(${distance} <= ${RELATED_ON_ITS_OWN} or (${distance} <= ${RELATED_WITH_SHARED_TOPIC} and (${sameCategory} or ${sharedTag})))`,
      ),
    )
    .orderBy(distance)
    .limit(limit);
}

// cache(): the (app) layout and the page both ask for these, so share one query per request.
export const listCategoriesWithCounts = cache(async (userId: string) => {
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
});

export const libraryStats = cache(async (userId: string) => {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      uncategorized: sql<number>`count(*) filter (where ${schema.bookmark.categoryId} is null)::int`,
      busy: sql<number>`count(*) filter (where ${schema.bookmark.status} in ('pending','processing'))::int`,
      // Ready but not yet filed: the AI is choosing a category (e.g. after their category was deleted).
      filing: sql<number>`count(*) filter (where ${schema.bookmark.status} = 'ready' and ${schema.bookmark.categoryId} is null and not ${schema.bookmark.categoryLocked})::int`,
      unread: sql<number>`count(*) filter (where ${schema.bookmark.readAt} is null)::int`,
    })
    .from(schema.bookmark)
    .where(eq(schema.bookmark.userId, userId));
  return row;
});

/** Cached so the library page and its metadata share one lookup. */
export const getCategoryBySlug = cache(async (userId: string, slug: string) => {
  const [row] = await db
    .select()
    .from(schema.category)
    .where(and(eq(schema.category.userId, userId), eq(schema.category.slug, slug)))
    .limit(1);
  return row ?? null;
});
