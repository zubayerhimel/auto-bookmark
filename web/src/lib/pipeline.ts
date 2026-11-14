import "server-only";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { analyzeContent, classifyItem, embedText } from "./ai";
import { findOrCreateCategory, listCategoryHints, pruneEmptyAiCategories } from "./categories";
import { extractFromUrl, socialSite } from "./extract";

/** Small in-process concurrency gate so bulk jobs don't fire hundreds of AI calls at once. */
function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

const limit = createLimiter(3);

function errorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 500);
}

async function refreshSearchVector(id: string) {
  await db.execute(sql`
    update ${schema.bookmark} set search_vector =
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', array_to_string(tags, ' ') || ' ' || coalesce(author, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(description, '') || ' ' || coalesce(note, '')), 'B') ||
      setweight(to_tsvector('english', left(coalesce(content, ''), 200000)), 'C')
    where id = ${id}
  `);
}

/**
 * Fetches the page again for the reader view. The new text replaces the saved copy only when it's
 * at least most of its length, so a copy the extension captured while logged in isn't swapped for
 * a sign-in wall or a paywall teaser.
 */
export async function refreshSavedCopy(userId: string, id: string): Promise<"updated" | "kept"> {
  const [b] = await db
    .select({ url: schema.bookmark.url, content: schema.bookmark.content })
    .from(schema.bookmark)
    .where(and(eq(schema.bookmark.id, id), eq(schema.bookmark.userId, userId)))
    .limit(1);
  if (!b) throw new Error("Bookmark not found.");
  const extracted = await extractFromUrl(b.url);
  const fresh = extracted.content;
  if (!fresh || fresh.length < (b.content?.length ?? 0) * 0.6) return "kept";
  await db.update(schema.bookmark).set({ content: fresh }).where(eq(schema.bookmark.id, id));
  await refreshSearchVector(id);
  return "updated";
}

/**
 * Waiting to be processed: pending, or "processing" for so long that the job doing it must have
 * died (a serverless function hitting its time limit mid-import, say).
 */
const waiting = or(
  eq(schema.bookmark.status, "pending"),
  and(eq(schema.bookmark.status, "processing"), lt(schema.bookmark.updatedAt, sql`now() - interval '10 minutes'`)),
)!;

export async function processBookmark(id: string) {
  // Claiming the row in one statement means two workers can never process the same bookmark.
  const [b] = await db
    .update(schema.bookmark)
    .set({ status: "processing", error: null })
    .where(and(eq(schema.bookmark.id, id), waiting))
    .returning();
  if (!b) return;

  try {
    const item = { ...b };
    const social = item.type === "tweet" || socialSite(item.url) !== null;
    const thinContent = !item.content || (!social && item.content.length < 300);
    if (thinContent) {
      try {
        const extracted = await extractFromUrl(item.url);
        item.title ||= extracted.title ?? null;
        item.description ||= extracted.description ?? null;
        item.author ||= extracted.author ?? null;
        item.siteName ||= extracted.siteName ?? null;
        item.imageUrl ||= extracted.imageUrl ?? null;
        item.publishedAt ||= extracted.publishedAt ?? null;
        if ((extracted.content?.length ?? 0) > (item.content?.length ?? 0)) {
          item.content = extracted.content ?? null;
        }
      } catch (err) {
        if (!item.content && !item.title) {
          throw new Error(`Couldn't read the page: ${errorMessage(err)}`);
        }
      }
      // Keep what was extracted even if the AI step below fails.
      await db
        .update(schema.bookmark)
        .set({
          title: item.title,
          description: item.description,
          author: item.author,
          siteName: item.siteName,
          imageUrl: item.imageUrl,
          publishedAt: item.publishedAt,
          content: item.content,
        })
        .where(eq(schema.bookmark.id, id));
      await refreshSearchVector(id);
    }

    const categories = await listCategoryHints(item.userId);
    const analysis = await analyzeContent(item, categories);

    let categoryId = item.categoryId;
    if (!item.categoryLocked) {
      const category = await findOrCreateCategory(item.userId, analysis.category, "ai");
      categoryId = category.id;
    }

    // Keep the page's own title for articles and videos; social posts get the AI's descriptive title.
    const title = social || !item.title ? analysis.title : item.title;
    // The first time through, keep tags it arrived with (folder names from an import) ahead of the AI's.
    const kept = b.processedAt ? [] : b.tags;
    const tags = [...new Set([...kept, ...analysis.tags].map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 10);

    const embedding = await embedText(
      [
        title,
        item.author && `By ${item.author}`,
        analysis.summary,
        analysis.keyPoints.join("\n"),
        `Tags: ${tags.join(", ")}`,
        item.note,
        item.content?.slice(0, 2000),
      ]
        .filter(Boolean)
        .join("\n"),
      "document",
    );

    await db
      .update(schema.bookmark)
      .set({
        title,
        description: item.description,
        author: item.author,
        siteName: item.siteName,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt,
        content: item.content,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints.slice(0, 6),
        tags,
        categoryId,
        embedding,
        status: "ready",
        error: null,
        processedAt: new Date(),
      })
      .where(eq(schema.bookmark.id, id));
    await refreshSearchVector(id);
    if (categoryId !== b.categoryId) await pruneEmptyAiCategories(item.userId);
  } catch (err) {
    console.error(`[pipeline] bookmark ${id} failed`, err);
    await db
      .update(schema.bookmark)
      .set({ status: "failed", error: errorMessage(err) })
      .where(eq(schema.bookmark.id, id));
    await refreshSearchVector(id).catch(() => {});
  }
}

export function processBookmarks(ids: string[]) {
  return Promise.all(ids.map((id) => limit(() => processBookmark(id))));
}

/**
 * Works through bookmarks still waiting to be processed (an import, or saves whose background job
 * was cut off), newest first, until none are left or the time budget runs out. Whatever is left
 * is picked up by the next call. `userId` null means every user's (the cron sweep).
 */
export async function drainPending(userId: string | null, budgetMs: number) {
  const deadline = Date.now() + budgetMs;
  const tried = new Set<string>();
  let processed = 0;
  while (Date.now() < deadline) {
    const rows = await db
      .select({ id: schema.bookmark.id })
      .from(schema.bookmark)
      .where(userId ? and(eq(schema.bookmark.userId, userId), waiting) : waiting)
      .orderBy(desc(schema.bookmark.createdAt))
      .limit(6);
    // Another worker may hold some of these; never spin on the same ids.
    const ids = rows.map((r) => r.id).filter((id) => !tried.has(id));
    if (!ids.length) break;
    for (const id of ids) tried.add(id);
    await processBookmarks(ids);
    processed += ids.length;
  }
  return processed;
}

/**
 * Re-files every bookmark the user hasn't pinned by hand. The user's own categories are kept, but
 * AI-made ones are rebuilt from scratch so an over-broad category can't keep absorbing everything.
 */
export async function recategorizeAll(userId: string) {
  const items = await db
    .select({
      id: schema.bookmark.id,
      title: schema.bookmark.title,
      summary: schema.bookmark.summary,
      tags: schema.bookmark.tags,
      url: schema.bookmark.url,
    })
    .from(schema.bookmark)
    .where(
      and(
        eq(schema.bookmark.userId, userId),
        eq(schema.bookmark.categoryLocked, false),
        eq(schema.bookmark.status, "ready"),
      ),
    );

  const chosenThisRun = new Set<string>();
  await Promise.all(
    items.map((item) =>
      limit(async () => {
        try {
          // Re-read so categories created earlier in this run are offered to later items.
          const categories = (await listCategoryHints(userId)).filter(
            (c) => c.source === "user" || chosenThisRun.has(c.id),
          );
          const choice = await classifyItem(item, categories);
          const category = await findOrCreateCategory(userId, choice, "ai");
          chosenThisRun.add(category.id);
          await db
            .update(schema.bookmark)
            .set({ categoryId: category.id })
            .where(eq(schema.bookmark.id, item.id));
        } catch (err) {
          console.error(`[recategorize] ${item.id}`, err);
        }
      }),
    ),
  );
  await pruneEmptyAiCategories(userId);
}

/** Re-files only the given bookmarks (e.g. after their category was deleted). */
export async function recategorizeBookmarks(userId: string, ids: string[]) {
  if (!ids.length) return;
  const items = await db
    .select({
      id: schema.bookmark.id,
      title: schema.bookmark.title,
      summary: schema.bookmark.summary,
      tags: schema.bookmark.tags,
      url: schema.bookmark.url,
    })
    .from(schema.bookmark)
    .where(and(eq(schema.bookmark.userId, userId), inArray(schema.bookmark.id, ids)));
  for (const item of items) {
    await limit(async () => {
      try {
        const choice = await classifyItem(item, await listCategoryHints(userId));
        const category = await findOrCreateCategory(userId, choice, "ai");
        await db
          .update(schema.bookmark)
          .set({ categoryId: category.id })
          .where(eq(schema.bookmark.id, item.id));
      } catch (err) {
        console.error(`[recategorize] ${item.id}`, err);
        // Leave it in Uncategorized for the user to place, instead of "still filing" forever.
        await db
          .update(schema.bookmark)
          .set({ categoryLocked: true })
          .where(and(eq(schema.bookmark.id, item.id), isNull(schema.bookmark.categoryId)))
          .catch(() => {});
      }
    });
  }
}
