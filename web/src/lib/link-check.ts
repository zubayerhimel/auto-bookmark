import "server-only";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { checkLink, type LinkHealth } from "./extract";

/** How long a link check stays fresh before the daily job looks again. */
const RECHECK_AFTER_DAYS = 30;
const CONCURRENCY = 8;

/**
 * Checks one bookmark's link and records the result. An inconclusive answer only moves the check
 * date along; it never flips a link to dead or back.
 */
export async function checkBookmarkLink(id: string, url: string): Promise<LinkHealth> {
  const health = await checkLink(url);
  await db
    .update(schema.bookmark)
    .set({
      linkCheckedAt: new Date(),
      ...(health === "unknown" ? {} : { linkStatus: health }),
      // Keep updated_at as it was: it marks processing activity, which this isn't.
      updatedAt: sql`${schema.bookmark.updatedAt}`,
    })
    .where(eq(schema.bookmark.id, id));
  return health;
}

/** Checks the links that haven't been checked for longest, until `deadline` (a timestamp). */
export async function checkStaleLinks(deadline: number, limit = 400) {
  const rows = await db
    .select({ id: schema.bookmark.id, url: schema.bookmark.url })
    .from(schema.bookmark)
    .where(
      and(
        inArray(schema.bookmark.status, ["ready", "failed"]),
        or(
          isNull(schema.bookmark.linkCheckedAt),
          lt(schema.bookmark.linkCheckedAt, sql`now() - make_interval(days => ${RECHECK_AFTER_DAYS})`),
        ),
      ),
    )
    .orderBy(sql`${schema.bookmark.linkCheckedAt} asc nulls first`, asc(schema.bookmark.createdAt))
    .limit(limit);

  const counts = { checked: 0, dead: 0 };
  let next = 0;
  const worker = async () => {
    while (next < rows.length && Date.now() < deadline) {
      const row = rows[next++];
      try {
        if ((await checkBookmarkLink(row.id, row.url)) === "dead") counts.dead++;
        counts.checked++;
      } catch (err) {
        console.error("Link check failed", row.id, err);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return counts;
}
