"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { libraryQuery, listBookmarks, saveBookmark } from "./bookmarks";
import { findOrCreateCategory, pruneEmptyAiCategories, slugify, tidyName } from "./categories";
import { processBookmarks, recategorizeAll, recategorizeBookmarks } from "./pipeline";
import { loadLibraryParams } from "./search-params";
import { generateToken, hashToken, requireUser } from "./session";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Bookmarks ----------

/** The next page of the library list. `filters` is the list's query string, e.g. "?category=recipes". */
export async function loadMoreBookmarksAction(filters: string, cursor: string) {
  const user = await requireUser();
  const params = loadLibraryParams(new URLSearchParams(filters));
  return listBookmarks(user.id, { ...libraryQuery(params), cursor });
}

export async function addBookmarkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Paste a link to save." };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const saved = await saveBookmark(user.id, { url });
    after(() => processBookmarks([saved.id]));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "That link couldn't be saved." };
  }
  refresh();
  return { ok: true, message: "Saved. Summarizing and filing it now." };
}

async function ownBookmark(userId: string, id: string) {
  const [row] = await db
    .select({ id: schema.bookmark.id, categoryId: schema.bookmark.categoryId })
    .from(schema.bookmark)
    .where(and(eq(schema.bookmark.id, id), eq(schema.bookmark.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Bookmark not found.");
  return row;
}

export async function deleteBookmarkAction(id: string) {
  const user = await requireUser();
  await ownBookmark(user.id, id);
  await db.delete(schema.bookmark).where(eq(schema.bookmark.id, id));
  await pruneEmptyAiCategories(user.id);
  refresh();
  redirect("/library");
}

export async function reprocessBookmarkAction(id: string) {
  const user = await requireUser();
  await ownBookmark(user.id, id);
  await db.update(schema.bookmark).set({ status: "pending", error: null }).where(eq(schema.bookmark.id, id));
  after(() => processBookmarks([id]));
  refresh();
}

/** Puts a bookmark on (or takes it off) the reading list. */
export async function setBookmarkReadAction(id: string, read: boolean) {
  const user = await requireUser();
  // Ownership is checked in the same statement: this runs on every open, so keep it to one query.
  const updated = await db
    .update(schema.bookmark)
    .set({ readAt: read ? new Date() : null })
    .where(and(eq(schema.bookmark.id, id), eq(schema.bookmark.userId, user.id)))
    .returning({ id: schema.bookmark.id });
  if (!updated.length) throw new Error("Bookmark not found.");
  refresh();
}

/** Clears the reading list in one go. */
export async function markAllReadAction() {
  const user = await requireUser();
  await db
    .update(schema.bookmark)
    .set({ readAt: new Date() })
    .where(and(eq(schema.bookmark.userId, user.id), isNull(schema.bookmark.readAt)));
  refresh();
}

/**
 * Moves a bookmark to a category. `choice` is a category id, "auto" to let the AI decide
 * again, or "new:<name>" to create a category on the spot.
 */
export async function setBookmarkCategoryAction(id: string, choice: string) {
  const user = await requireUser();
  await ownBookmark(user.id, id);

  if (choice === "auto") {
    await db.update(schema.bookmark).set({ categoryLocked: false }).where(eq(schema.bookmark.id, id));
    after(() => recategorizeBookmarks(user.id, [id]).then(() => pruneEmptyAiCategories(user.id)));
    refresh();
    return;
  }

  let categoryId: string;
  if (choice.startsWith("new:")) {
    const name = tidyName(choice.slice(4));
    if (!name) throw new Error("Give the category a name.");
    categoryId = (await findOrCreateCategory(user.id, { name }, "user")).id;
  } else {
    const [cat] = await db
      .select({ id: schema.category.id })
      .from(schema.category)
      .where(and(eq(schema.category.id, choice), eq(schema.category.userId, user.id)))
      .limit(1);
    if (!cat) throw new Error("Category not found.");
    categoryId = cat.id;
  }

  await db
    .update(schema.bookmark)
    .set({ categoryId, categoryLocked: true })
    .where(eq(schema.bookmark.id, id));
  await pruneEmptyAiCategories(user.id);
  refresh();
}

// ---------- Categories ----------

export async function createCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = tidyName(String(formData.get("name") ?? ""));
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return { error: "Give the category a name." };

  const [existing] = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(and(eq(schema.category.userId, user.id), eq(schema.category.slug, slugify(name))))
    .limit(1);
  if (existing) return { error: `You already have a category called ${name}.` };

  await findOrCreateCategory(user.id, { name, description }, "user");
  refresh();
  return { ok: true, message: `Created ${name}. Re-file your library to move matching bookmarks into it.` };
}

export async function updateCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = tidyName(String(formData.get("name") ?? ""));
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return { error: "Give the category a name." };

  const slug = slugify(name);
  const [clash] = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(
      and(eq(schema.category.userId, user.id), eq(schema.category.slug, slug), ne(schema.category.id, id)),
    )
    .limit(1);
  if (clash) return { error: `Another category is already called ${name}. Merge them instead.` };

  // Editing a category makes it the user's: it's no longer auto-deleted when empty.
  await db
    .update(schema.category)
    .set({ name, slug, description, source: "user" })
    .where(and(eq(schema.category.id, id), eq(schema.category.userId, user.id)));
  refresh();
  return { ok: true, message: "Saved changes." };
}

export async function deleteCategoryAction(id: string, refile: boolean) {
  const user = await requireUser();
  const moved = await db
    .update(schema.bookmark)
    .set({ categoryId: null, categoryLocked: false })
    .where(and(eq(schema.bookmark.categoryId, id), eq(schema.bookmark.userId, user.id)))
    .returning({ id: schema.bookmark.id });
  await db
    .delete(schema.category)
    .where(and(eq(schema.category.id, id), eq(schema.category.userId, user.id)));
  if (refile && moved.length) {
    after(() => recategorizeBookmarks(user.id, moved.map((m) => m.id)));
  }
  refresh();
}

export async function mergeCategoryAction(fromId: string, intoId: string) {
  const user = await requireUser();
  if (fromId === intoId) return;
  const owned = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(eq(schema.category.userId, user.id));
  const ids = new Set(owned.map((c) => c.id));
  if (!ids.has(fromId) || !ids.has(intoId)) throw new Error("Category not found.");

  await db
    .update(schema.bookmark)
    .set({ categoryId: intoId })
    .where(and(eq(schema.bookmark.categoryId, fromId), eq(schema.bookmark.userId, user.id)));
  await db.delete(schema.category).where(eq(schema.category.id, fromId));
  refresh();
}

export async function recategorizeAllAction(): Promise<ActionState> {
  const user = await requireUser();
  after(() => recategorizeAll(user.id));
  return {
    ok: true,
    message: "Re-filing your library in the background. Bookmarks you placed by hand stay put.",
  };
}

export async function retryFailedAction() {
  const user = await requireUser();
  const failed = await db
    .update(schema.bookmark)
    .set({ status: "pending", error: null })
    .where(and(eq(schema.bookmark.userId, user.id), eq(schema.bookmark.status, "failed")))
    .returning({ id: schema.bookmark.id });
  after(() => processBookmarks(failed.map((f) => f.id)));
  refresh();
}

// ---------- Extension tokens ----------

export async function createExtensionTokenAction(name: string) {
  const user = await requireUser();
  const token = generateToken();
  await db.insert(schema.apiToken).values({
    userId: user.id,
    name: name.trim().slice(0, 80) || "Browser extension",
    tokenHash: hashToken(token),
  });
  revalidatePath("/extension");
  return token;
}

export async function revokeExtensionTokenAction(id: string) {
  const user = await requireUser();
  await db
    .delete(schema.apiToken)
    .where(and(eq(schema.apiToken.id, id), eq(schema.apiToken.userId, user.id)));
  revalidatePath("/extension");
}
