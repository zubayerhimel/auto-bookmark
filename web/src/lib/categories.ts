import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Ribbon colours, picked to stay legible as thin bars and text on the light paper background. */
export const CATEGORY_COLORS = [
  "#2446C7", // ink blue
  "#C2410C", // rust
  "#0F766E", // teal
  "#7C3AED", // violet
  "#B45309", // ochre
  "#BE185D", // magenta
  "#15803D", // green
  "#0369A1", // sky
  "#9F1239", // garnet
  "#4D7C0F", // olive
  "#6D28D9", // indigo
  "#A16207", // mustard
];

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "uncategorized"
  );
}

export function tidyName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 60);
}

function colorFor(slug: string) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length];
}

export async function listCategoryHints(userId: string) {
  return db
    .select({
      id: schema.category.id,
      name: schema.category.name,
      description: schema.category.description,
      source: schema.category.source,
    })
    .from(schema.category)
    .where(eq(schema.category.userId, userId))
    .orderBy(schema.category.name);
}

export async function findOrCreateCategory(
  userId: string,
  input: { name: string; description?: string | null },
  source: "ai" | "user",
) {
  const name = tidyName(input.name);
  const slug = slugify(name);
  const [existing] = await db
    .select()
    .from(schema.category)
    .where(and(eq(schema.category.userId, userId), eq(schema.category.slug, slug)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(schema.category)
    .values({
      userId,
      name,
      slug,
      description: input.description?.trim() || null,
      color: colorFor(slug),
      source,
    })
    .onConflictDoUpdate({
      target: [schema.category.userId, schema.category.slug],
      set: { updatedAt: sql`now()` },
    })
    .returning();
  return created;
}

/** Removes AI-created categories that no longer hold any bookmarks. */
export async function pruneEmptyAiCategories(userId: string) {
  await db.execute(sql`
    delete from ${schema.category} c
    where c.user_id = ${userId}
      and c.source = 'ai'
      and not exists (select 1 from ${schema.bookmark} b where b.category_id = c.id)
  `);
}
