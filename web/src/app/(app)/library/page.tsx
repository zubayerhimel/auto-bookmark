import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BookmarkType } from "@/db/schema";
import { BookmarkPlusIcon, CheckCheckIcon, CircleAlertIcon, PuzzleIcon, RotateCwIcon } from "lucide-react";
import { AddLinkForm } from "@/components/add-link-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { BookmarkRow, bookmarkListClass } from "@/components/bookmark-row";
import { SearchPanel } from "@/components/search-panel";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { markAllReadAction, retryFailedAction } from "@/lib/actions";
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
  const unread = one(params.view) === "unread";
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
    unread,
    before,
  });
  const busy = items.some((i) => i.status === "pending" || i.status === "processing");
  const failed = items.filter((i) => i.status === "failed").length;

  const heading =
    category?.name ?? (slug === "uncategorized" ? "Uncategorized" : unread ? "To read" : "All bookmarks");
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    if (slug) next.set("category", slug);
    if (type) next.set("type", type);
    if (unread) next.set("view", "unread");
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
        <header className="mt-10 flex flex-col gap-5 sm:mt-12 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {category ? (
              <span aria-hidden className="ribbon-mark mt-1 h-12 w-3.5 shrink-0" style={{ background: category.color }} />
            ) : null}
            <div className="min-w-0">
              <h1 className="text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-bold tracking-tight break-words">
                {heading}
              </h1>
              {category?.description ? (
                <p className="mt-1.5 max-w-[60ch] text-ink-soft">{category.description}</p>
              ) : unread && !slug ? (
                <p className="mt-1.5 max-w-[60ch] text-ink-soft">
                  Everything you&apos;ve saved but not opened yet. Opening a bookmark takes it off this list.
                </p>
              ) : null}
            </div>
          </div>
          <div className="w-full shrink-0 md:max-w-sm">
            <AddLinkForm />
          </div>
        </header>

        <nav aria-label="Filter by kind" className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <ul className="flex min-w-full w-max gap-6 shadow-[inset_0_-1px_0_var(--rule)]">
            {TYPES.map((t) => {
              const current = (type ?? "all") === t.key;
              return (
                <li key={t.key}>
                  <Link
                    href={qs({ type: t.key === "all" ? undefined : t.key, before: undefined })}
                    aria-current={current ? "page" : undefined}
                    className="inline-flex h-10 items-center border-b-2 border-transparent text-sm font-medium text-ink-faint transition-colors duration-150 ease-out hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
            <li className="ml-auto pl-6">
              <Link
                href={qs({ view: unread ? undefined : "unread", before: undefined })}
                data-on={unread}
                className="group/toread inline-flex h-10 items-center gap-2 border-b-2 border-transparent text-sm font-medium text-ink-faint transition-colors duration-150 ease-out hover:text-ink data-[on=true]:border-action data-[on=true]:text-action"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full border border-current transition-colors duration-150 ease-out group-data-[on=true]/toread:bg-current"
                />
                Only to read
                <span className="sr-only">{unread ? "(on)" : "(off)"}</span>
              </Link>
            </li>
          </ul>
        </nav>

        {unread && !slug && !type && items.length > 0 ? (
          <form action={markAllReadAction} className="mt-3 flex justify-end">
            <Button type="submit" variant="ghost" size="sm" className="text-ink-soft">
              <CheckCheckIcon data-icon="inline-start" />
              Mark all as read
            </Button>
          </form>
        ) : null}

        {failed > 0 ? (
          <Alert variant="destructive" className="mt-4">
            <CircleAlertIcon />
            <AlertTitle>
              {failed === 1 ? "One bookmark" : `${failed} bookmarks`} couldn&apos;t be summarized.
            </AlertTitle>
            <AlertDescription>Usually a timeout or a page that blocks readers. Trying again often works.</AlertDescription>
            <AlertAction>
              <form action={retryFailedAction}>
                <Button type="submit" variant="outline" size="sm">
                  <RotateCwIcon data-icon="inline-start" />
                  Try again
                </Button>
              </form>
            </AlertAction>
          </Alert>
        ) : null}

        {items.length === 0 ? (
          unread && !before ? (
            <Empty className="mt-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckCheckIcon />
                </EmptyMedia>
                <EmptyTitle>You&apos;re all caught up</EmptyTitle>
                <EmptyDescription>New saves land here until you open them.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : before || type || slug ? (
            <Empty className="mt-6">
              <EmptyHeader>
                <EmptyTitle>Nothing here yet</EmptyTitle>
                <EmptyDescription>Bookmarks you save that fit this filter will show up here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Empty className="mt-6 border border-dashed bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookmarkPlusIcon />
                </EmptyMedia>
                <EmptyTitle>Your library is empty</EmptyTitle>
                <EmptyDescription>
                  Paste a link above, or connect the browser extension and click its button on any page, post on X,
                  or YouTube video.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href="/extension">
                    <PuzzleIcon data-icon="inline-start" />
                    Connect the extension
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          )
        ) : (
          <ol className={`mt-5 ${bookmarkListClass}`}>
            {items.map((item) => (
              <BookmarkRow key={item.id} item={item} showUnread={!unread} />
            ))}
          </ol>
        )}

        {items.length === PAGE_SIZE ? (
          <Button asChild variant="outline" className="mt-6">
            <Link href={qs({ before: items[items.length - 1].createdAt.toISOString() })}>Show older bookmarks</Link>
          </Button>
        ) : null}
      </SearchPanel>
    </div>
  );
}
