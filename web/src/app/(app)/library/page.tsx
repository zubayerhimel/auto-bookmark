import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import type { BookmarkType } from "@/db/schema";
import { BookmarkPlusIcon, CheckCheckIcon, CircleAlertIcon, FileUpIcon, KeyRoundIcon, PuzzleIcon, RotateCwIcon, StarIcon, XIcon } from "lucide-react";
import { AddLinkForm } from "@/components/add-link-form";
import { BookmarkFeed } from "@/components/bookmark-feed";
import { SortMenu } from "@/components/sort-menu";
import { SearchPanel } from "@/components/search-panel";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { markAllReadAction, retryFailedAction } from "@/lib/actions";
import { getAiConfig } from "@/lib/ai-settings";
import { getCategoryBySlug, libraryQuery, listBookmarks, listCategoriesWithCounts } from "@/lib/bookmarks";
import { libraryHref, loadLibraryParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";

const TYPES: { key: BookmarkType | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "web", label: "Pages" },
  { key: "tweet", label: "Posts on X" },
  { key: "youtube", label: "Videos" },
];

type PageProps = { searchParams: Promise<SearchParams> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { category: slug, view, tag, favorites } = await loadLibraryParams(searchParams);
  if (slug === "uncategorized") return { title: "Uncategorized" };
  if (!slug && tag) return { title: `#${tag}` };
  if (!slug && favorites) return { title: "Favorites" };
  if (view === "unread") return { title: "To read" };
  if (!slug) return { title: "Library" };
  const user = await requireUser();
  const category = await getCategoryBySlug(user.id, slug);
  return { title: category?.name ?? "Library" };
}

export default async function LibraryPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await loadLibraryParams(searchParams);
  const { category: slug, type: typeParam, view, sort } = params;
  const type = typeParam ?? undefined;
  const unread = view === "unread";
  const query = libraryQuery(params);
  const tag = query.tag ?? null;
  const favorites = query.favorites || null;

  const [category, { items, nextCursor }, categories, ai] = await Promise.all([
    query.categorySlug ? getCategoryBySlug(user.id, query.categorySlug) : null,
    listBookmarks(user.id, query),
    listCategoriesWithCounts(user.id),
    getAiConfig(user.id),
  ]);
  if (query.categorySlug && !category) notFound();
  const failed = items.filter((i) => i.status === "failed").length;

  const heading =
    category?.name ??
    (slug === "uncategorized"
      ? "Uncategorized"
      : tag
        ? `#${tag}`
        : favorites
          ? "Favorites"
          : unread
            ? "To read"
            : "All bookmarks");
  const qs = (patch: Parameters<typeof libraryHref>[1]) =>
    libraryHref("/library", { category: slug, tag, favorites, type: typeParam, view, sort, ...patch });
  const filters = libraryHref({ category: slug, tag, favorites, type: typeParam, view, sort });

  return (
    <div className="mx-auto max-w-4xl">
      <SearchPanel>
        <header className="mt-10 flex flex-col gap-5 sm:mt-12 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {category ? (
              <span aria-hidden className="ribbon-mark mt-1 h-12 w-3.5 shrink-0" style={{ background: category.color }} />
            ) : null}
            <div className="min-w-0">
              <h1 className="text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-semibold tracking-tight break-words">
                {heading}
              </h1>
              {category?.description ? (
                <p className="mt-1.5 max-w-[60ch] text-ink-soft">{category.description}</p>
              ) : unread && !slug && !tag && !favorites ? (
                <p className="mt-1.5 max-w-[60ch] text-ink-soft">
                  Everything you&apos;ve saved but not opened yet. Opening a bookmark takes it off this list.
                </p>
              ) : favorites && !slug && !tag ? (
                <p className="mt-1.5 max-w-[60ch] text-ink-soft">
                  Bookmarks you starred. Star one from its card or its page to keep it here.
                </p>
              ) : null}
              {tag ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <Badge variant="secondary" className="h-6 gap-1 pr-1 text-sm">
                    Tagged #{tag}
                    <Link
                      href={qs({ tag: null })}
                      aria-label={`Stop filtering by #${tag}`}
                      className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:bg-foreground/10 hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </Link>
                  </Badge>
                  <Link href="/tags" className="underline-offset-4 hover:text-ink hover:underline">
                    All tags
                  </Link>
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
                    href={qs({ type: t.key === "all" ? null : t.key })}
                    aria-current={current ? "page" : undefined}
                    className="inline-flex h-10 items-center border-b-2 border-transparent text-sm font-medium text-ink-faint transition-colors duration-150 ease-out hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
            <li className="ml-auto flex gap-6 pl-6">
              <Link
                href={qs({ favorites: favorites ? null : true })}
                data-on={!!favorites}
                className="inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent text-sm font-medium text-ink-faint transition-colors duration-150 ease-out hover:text-ink data-[on=true]:border-amber-500 data-[on=true]:text-ink"
              >
                <StarIcon
                  aria-hidden
                  className="size-3.5 transition-colors duration-150 ease-out in-data-[on=true]:fill-amber-500 in-data-[on=true]:text-amber-500"
                />
                Favorites
                <span className="sr-only">{favorites ? "(on)" : "(off)"}</span>
              </Link>
              <Link
                href={qs({ view: unread ? null : "unread" })}
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

        {!ai ? (
          <Alert className="mt-4">
            <KeyRoundIcon />
            <AlertTitle>Add your AI key to get summaries.</AlertTitle>
            <AlertDescription>
              Links are saved, but they&apos;re summarized, tagged and filed with your own OpenAI, Claude, Gemini or
              OpenRouter key.
            </AlertDescription>
            <AlertAction>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">Add key</Link>
              </Button>
            </AlertAction>
          </Alert>
        ) : failed > 0 ? (
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
          unread ? (
            <Empty className="mt-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckCheckIcon />
                </EmptyMedia>
                <EmptyTitle>You&apos;re all caught up</EmptyTitle>
                <EmptyDescription>New saves land here until you open them.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : favorites && !type && !slug && !tag ? (
            <Empty className="mt-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <StarIcon />
                </EmptyMedia>
                <EmptyTitle>No favorites yet</EmptyTitle>
                <EmptyDescription>Star a bookmark from its card or its page and it shows up here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : type || slug || tag || favorites ? (
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
                  or YouTube video. Already have bookmarks elsewhere? Bring them in.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row flex-wrap justify-center">
                <Button asChild>
                  <Link href="/extension">
                    <PuzzleIcon data-icon="inline-start" />
                    Connect the extension
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/import">
                    <FileUpIcon data-icon="inline-start" />
                    Import bookmarks
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          )
        ) : (
          <BookmarkFeed
            key={filters}
            items={items}
            nextCursor={nextCursor}
            filters={filters}
            showUnread={!unread}
            categories={categories.map(({ id, name, color }) => ({ id, name, color }))}
            toolbar={
              <>
                {unread && !slug && !type && !tag && !favorites ? (
                  <form action={markAllReadAction}>
                    <Button type="submit" variant="ghost" size="sm" className="text-ink-soft">
                      <CheckCheckIcon data-icon="inline-start" />
                      Mark all as read
                    </Button>
                  </form>
                ) : null}
                <SortMenu />
              </>
            }
          />
        )}
      </SearchPanel>
    </div>
  );
}
