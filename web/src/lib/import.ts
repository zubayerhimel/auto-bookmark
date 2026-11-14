import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { detectType, normalizeUrl } from "./extract";
import { IMPORT_CAP, IMPORT_CHUNK, parseWhen } from "./import-parse";

export type ImportResult = { added: number; existing: number; invalid: number; overCap: number };

function cleanItem(raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.url !== "string" || r.url.length > 2048) return null;
  let url: string;
  try {
    url = normalizeUrl(r.url);
  } catch {
    return null;
  }
  const title = typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim().slice(0, 300) || null : null;
  const addedAt = typeof r.addedAt === "number" ? parseWhen(String(Math.round(r.addedAt))) : null;
  const tags = Array.isArray(r.tags)
    ? [...new Set(r.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 5)
    : [];
  return { url, title, addedAt: addedAt ? new Date(addedAt) : null, tags, read: r.read !== false };
}

/**
 * Adds links the user doesn't have yet, up to `budget` of them, and leaves ones already saved
 * untouched (re-saving would bump them to the top of the library). They start out pending; the
 * caller kicks off processing.
 */
export async function importBookmarks(userId: string, rawItems: unknown, budget: number): Promise<ImportResult> {
  if (!Array.isArray(rawItems) || rawItems.length > IMPORT_CHUNK) throw new Error("Invalid import batch.");
  const room = Math.max(0, Math.min(Math.floor(budget) || 0, IMPORT_CAP));

  let invalid = 0;
  const byUrl = new Map<string, NonNullable<ReturnType<typeof cleanItem>>>();
  for (const raw of rawItems) {
    const item = cleanItem(raw);
    if (!item) invalid++;
    else if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  }
  if (!byUrl.size) return { added: 0, existing: 0, invalid, overCap: 0 };

  const saved = await db
    .select({ url: schema.bookmark.url })
    .from(schema.bookmark)
    .where(and(eq(schema.bookmark.userId, userId), inArray(schema.bookmark.url, [...byUrl.keys()])));
  const savedUrls = new Set(saved.map((s) => s.url));
  const fresh = [...byUrl.values()].filter((item) => !savedUrls.has(item.url));
  const toAdd = fresh.slice(0, room);

  let added = 0;
  if (toAdd.length) {
    const now = new Date();
    const rows = await db
      .insert(schema.bookmark)
      .values(
        toAdd.map((item) => ({
          userId,
          url: item.url,
          type: detectType(item.url),
          title: item.title,
          tags: item.tags,
          status: "pending" as const,
          createdAt: item.addedAt ?? now,
          // Imported bookmarks aren't new finds, so they stay off the reading list unless the source says unread.
          readAt: item.read ? now : null,
        })),
      )
      .onConflictDoNothing({ target: [schema.bookmark.userId, schema.bookmark.url] })
      .returning({ id: schema.bookmark.id });
    added = rows.length;
  }

  return {
    added,
    existing: byUrl.size - fresh.length + (toAdd.length - added),
    invalid,
    overCap: fresh.length - toAdd.length,
  };
}
