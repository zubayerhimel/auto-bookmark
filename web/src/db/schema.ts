import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

export const EMBEDDING_DIMENSIONS = 1536;

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// User ids come from Supabase Auth (auth.users). The app's server talks to Postgres directly and
// bypasses RLS; the policies below keep rows private if the tables are ever read through the
// Supabase Data API with a user's session.
const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" });

const ownRows = (name: string, column: AnyPgColumn) =>
  pgPolicy(name, {
    for: "all",
    to: authenticatedRole,
    using: sql`${authUid} = ${column}`,
    withCheck: sql`${authUid} = ${column}`,
  });

// ---------- App tables ----------

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    color: text("color").notNull(),
    /** "ai" when the model created it on the fly, "user" when created by hand. */
    source: text("source", { enum: ["ai", "user"] }).notNull().default("ai"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("category_user_slug_idx").on(t.userId, t.slug),
    ownRows("category_owner", t.userId),
  ],
);

export type BookmarkType = "web" | "tweet" | "youtube";
export type BookmarkStatus = "pending" | "processing" | "ready" | "failed";

export const bookmark = pgTable(
  "bookmark",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    url: text("url").notNull(),
    type: text("type", { enum: ["web", "tweet", "youtube"] })
      .notNull()
      .default("web"),
    title: text("title"),
    description: text("description"),
    author: text("author"),
    siteName: text("site_name"),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at"),
    /** Plain-text content captured from the page (truncated). */
    content: text("content"),
    /** Text the user had highlighted when saving. */
    note: text("note"),
    summary: text("summary"),
    keyPoints: jsonb("key_points").$type<string[]>(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    /** True once the user picks a category by hand; AI re-runs leave it alone. */
    categoryLocked: boolean("category_locked").notNull().default(false),
    status: text("status", {
      enum: ["pending", "processing", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    error: text("error"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    processedAt: timestamp("processed_at"),
  },
  (t) => [
    uniqueIndex("bookmark_user_url_idx").on(t.userId, t.url),
    index("bookmark_user_created_idx").on(t.userId, t.createdAt),
    index("bookmark_user_category_idx").on(t.userId, t.categoryId),
    index("bookmark_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    index("bookmark_search_idx").using("gin", t.searchVector),
    ownRows("bookmark_owner", t.userId),
  ],
);

export const apiToken = pgTable(
  "api_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("api_token_user_idx").on(t.userId)],
).enableRLS(); // No policies: tokens are only ever read by the server.

export type Bookmark = typeof bookmark.$inferSelect;
export type Category = typeof category.$inferSelect;
