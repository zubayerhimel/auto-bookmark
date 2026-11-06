import "server-only";
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BookmarkType } from "@/db/schema";
import { embedText, planSearch, type QueryPlan } from "./ai";
import { listFields, type BookmarkListItem } from "./bookmarks";

export type SearchResult = {
  results: (BookmarkListItem & { score: number })[];
  /** Filters the AI read out of the request, shown back to the user. */
  understood: {
    searchText: string;
    type: BookmarkType | null;
    category: string | null;
    savedAfter: string | null;
    savedBefore: string | null;
  } | null;
  terms: string[];
};

const RRF_K = 60;

function validDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Hybrid search: semantic similarity (pgvector) and keyword relevance (Postgres full-text)
 * merged with reciprocal rank fusion. Longer natural-language requests are first read by
 * the AI to pull out filters like "YouTube" or "last month".
 */
export async function searchBookmarks(
  userId: string,
  query: string,
  opts: { categoryId?: string | null; type?: BookmarkType | null } = {},
): Promise<SearchResult> {
  const q = query.trim().slice(0, 500);
  if (!q) return { results: [], understood: null, terms: [] };

  const categories = await db
    .select({ id: schema.category.id, name: schema.category.name })
    .from(schema.category)
    .where(eq(schema.category.userId, userId));

  let plan: QueryPlan | null = null;
  if (q.split(/\s+/).length >= 3) {
    plan = await planSearch(q, categories.map((c) => c.name)).catch((err) => {
      console.error("[search] planning failed", err);
      return null;
    });
  }

  const searchText = plan?.searchText?.trim() || q;
  const type = opts.type ?? (plan && plan.type !== "any" ? plan.type : null);
  const planCategory = plan?.category
    ? categories.find((c) => c.name.toLowerCase() === plan.category!.toLowerCase())
    : undefined;
  const categoryId = opts.categoryId ?? planCategory?.id ?? null;
  const after = validDate(plan?.savedAfter);
  const before = validDate(plan?.savedBefore);

  const filters: SQL[] = [sql`b.user_id = ${userId}`];
  if (type) filters.push(sql`b.type = ${type}`);
  if (categoryId) filters.push(sql`b.category_id = ${categoryId}`);
  if (after) filters.push(sql`b.created_at >= ${after}`);
  if (before) filters.push(sql`b.created_at < ${new Date(before.getTime() + 86_400_000)}`);
  const where = sql.join(filters, sql` and `);

  const embedding = await embedText(searchText, "query").catch((err) => {
    console.error("[search] embedding failed, falling back to keywords", err);
    return null;
  });

  // Words joined with OR so a loosely remembered phrase still matches partially.
  const keywordText = `${searchText} ${q}`;
  const tsQuery = sql`nullif(replace(plainto_tsquery('english', ${keywordText})::text, ' & ', ' | '), '')::tsquery`;

  const semantic = embedding
    ? sql`
      sem as (
        select b.id, b.embedding <=> ${JSON.stringify(embedding)}::vector as dist
        from ${schema.bookmark} b
        where ${where} and b.embedding is not null
        order by dist
        limit 40
      ),
      sem_ranked as (
        select id, row_number() over (order by dist) as r
        from sem
        where dist <= (select min(dist) from sem) + 0.15
      ),`
    : sql`sem_ranked as (select null::uuid as id, null::bigint as r where false),`;

  const rows = await db.execute<{ id: string; score: number }>(sql`
    with ${semantic}
    kw as (
      select b.id, row_number() over (order by ts_rank_cd(b.search_vector, ${tsQuery}) desc) as r
      from ${schema.bookmark} b
      where ${where} and b.search_vector @@ ${tsQuery}
      order by r
      limit 40
    )
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (${RRF_K} + s.r), 0) + coalesce(1.0 / (${RRF_K} + k.r), 0) as score
    from sem_ranked s
    full outer join kw k on k.id = s.id
    order by score desc
    limit 30
  `);

  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db
        .select(listFields)
        .from(schema.bookmark)
        .leftJoin(schema.category, eq(schema.category.id, schema.bookmark.categoryId))
        .where(inArray(schema.bookmark.id, ids))
    : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const results = rows
    .map((r) => {
      const item = byId.get(r.id);
      return item ? { ...item, score: Number(r.score) } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const terms = [...new Set(searchText.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'+#.-]{2,}/gu) ?? [])];

  return {
    results,
    understood: plan
      ? {
          searchText,
          type,
          category: planCategory?.name ?? null,
          savedAfter: after ? plan.savedAfter : null,
          savedBefore: before ? plan.savedBefore : null,
        }
      : null,
    terms,
  };
}
