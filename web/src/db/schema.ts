import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMENSIONS = 1536;

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// User ids are Clerk user ids ("user_…"). Only the app's server reads these tables; RLS is on with
// no policies, so the public Supabase Data API can't read or write them.
const userId = () => text("user_id").notNull();

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
  (t) => [uniqueIndex("category_user_slug_idx").on(t.userId, t.slug)],
).enableRLS();

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
  ],
).enableRLS();

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
).enableRLS();

export type Bookmark = typeof bookmark.$inferSelect;
export type Category = typeof category.$inferSelect;
