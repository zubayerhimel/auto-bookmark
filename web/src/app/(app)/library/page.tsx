import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BookmarkType } from "@/db/schema";
import { AddLinkForm } from "@/components/add-link-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { BookmarkRow } from "@/components/bookmark-row";
import { SearchPanel } from "@/components/search-panel";
import { retryFailedAction } from "@/lib/actions";
import { listBookmarks, PAGE_SIZE } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

const TYPES: { key: BookmarkType | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "web", label: "Pages" },
  { key: "tweet", label: "Posts on X" },
  { key: "youtube", label: "Videos" },
];

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const slug = one(params.category);
  const typeParam = one(params.type);
  const type = TYPES.some((t) => t.key === typeParam && t.key !== "all") ? (typeParam as BookmarkType) : undefined;
  const beforeParam = one(params.before);
  const before = beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? new Date(beforeParam) : undefined;

  let category: typeof schema.category.$inferSelect | undefined;
  if (slug && slug !== "uncategorized") {
    [category] = await db
      .select()
      .from(schema.category)
      .where(and(eq(schema.category.userId, user.id), eq(schema.category.slug, slug)))
      .limit(1);
    if (!category) notFound();
  }

  const items = await listBookmarks(user.id, {
    categoryId: category?.id,
    uncategorized: slug === "uncategorized",
    type,
    before,
  });
  const busy = items.some((i) => i.status === "pending" || i.status === "processing");
  const failed = items.filter((i) => i.status === "failed").length;

  const heading = category?.name ?? (slug === "uncategorized" ? "Uncategorized" : "All bookmarks");
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    if (slug) next.set("category", slug);
    if (type) next.set("type", type);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    return s ? `/library?${s}` : "/library";
  };

  return (
    <div className="mx-auto max-w-4xl">
      <AutoRefresh active={busy} />
      <SearchPanel initialQuery={one(params.q) ?? ""}>
        <header className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
              {category ? (
                <span aria-hidden className="h-6 w-1.5 rounded-full" style={{ background: category.color }} />
              ) : null}
              {heading}
            </h1>
            {category?.description ? (
              <p className="mt-1 max-w-[60ch] text-sm text-ink-soft">{category.description}</p>
            ) : null}
          </div>
          <div className="w-full sm:max-w-sm">
            <AddLinkForm />
          </div>
        </header>

        <nav aria-label="Filter by kind" className="mt-4 flex gap-1 border-b border-rule">
          {TYPES.map((t) => {
            const current = (type ?? "all") === t.key;
            return (
              <Link
                key={t.key}
                href={qs({ type: t.key === "all" ? undefined : t.key, before: undefined })}
                aria-current={current ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                  current ? "border-ink font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {failed > 0 ? (
          <form action={retryFailedAction} className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-danger/5 px-4 py-3 text-sm">
            <span className="text-danger">
              {failed === 1 ? "One bookmark" : `${failed} bookmarks`} couldn&apos;t be summarized.
            </span>
            <button type="submit" className="font-semibold text-ink underline underline-offset-4 hover:text-action">
              Try again
            </button>
          </form>
        ) : null}

        {items.length === 0 ? (
          <div className="py-16">
            {before || type || slug ? (
              <p className="text-ink-soft">Nothing here yet.</p>
            ) : (
              <>
                <p className="text-lg font-semibold">Your library is empty.</p>
                <p className="mt-1 max-w-[52ch] text-ink-soft">
                  Paste a link above, or{" "}
                  <Link href="/extension" className="font-medium text-action underline underline-offset-4">
                    connect the browser extension
                  </Link>{" "}
                  and click its button on any page, post on X, or YouTube video.
                </p>
              </>
            )}
          </div>
        ) : (
          <ol className="divide-y divide-rule">
            {items.map((item) => (
              <BookmarkRow key={item.id} item={item} />
            ))}
          </ol>
        )}

        {items.length === PAGE_SIZE ? (
          <Link
            href={qs({ before: items[items.length - 1].createdAt.toISOString() })}
            className="mt-6 inline-block text-sm font-semibold text-action underline underline-offset-4"
          >
            Show older bookmarks
          </Link>
        ) : null}
      </SearchPanel>
    </div>
  );
}
