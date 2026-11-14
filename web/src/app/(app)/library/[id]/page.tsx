import type { Metadata } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, BookOpenTextIcon, CircleAlertIcon, ExternalLinkIcon, Link2OffIcon } from "lucide-react";
import { BookmarkActions } from "@/components/bookmark-actions";
import { CheckLinkButton } from "@/components/check-link-button";
import { RowRibbon } from "@/components/row-ribbon";
import { CategoryPicker } from "@/components/category-picker";
import { RelatedShelf } from "@/components/related-shelf";
import { TypeIcon } from "@/components/type-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBookmark, listCategoriesWithCounts, relatedBookmarks, type BookmarkListItem } from "@/lib/bookmarks";
import { youtubeId } from "@/lib/extract";
import { hostOf, timeAgo, TYPE_LABEL } from "@/lib/format";
import { readingMinutes } from "@/lib/reader";
import { requireUser } from "@/lib/session";
import { libraryHref } from "@/lib/search-params";

const loadBookmark = cache(getBookmark);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  const row = await loadBookmark(user.id, (await params).id);
  return { title: row?.bookmark.title || "Bookmark" };
}

export default async function BookmarkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // Start everything at once; the related list streams in on its own so it never holds up the page.
  const related = relatedBookmarks(user.id, id);
  related.catch(() => {}); // Still rejects where it's awaited; this only stops an unhandled rejection if the page bails first.
  const [row, categories] = await Promise.all([loadBookmark(user.id, id), listCategoriesWithCounts(user.id)]);
  if (!row) notFound();
  const { bookmark: b, category } = row;

  const busy = b.status === "pending" || b.status === "processing";
  const filing = b.status === "ready" && !b.categoryId && !b.categoryLocked;
  const videoId = b.type === "youtube" ? youtubeId(b.url) : null;
  const color = category?.color ?? "var(--rule)";

  return (
    <article className="mx-auto max-w-5xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/library">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to library
        </Link>
      </Button>

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative min-w-0 rounded-2xl border border-rule bg-card px-5 pt-7 pb-8 sm:px-10 sm:pt-9 sm:pb-10">
          <RowRibbon busy={busy || filing} color={color} className="absolute -top-px left-5 h-20 w-4 sm:left-10 sm:h-24 sm:w-5" />
          <div className="pl-9 sm:pl-11">
            <header>
              <p className="category-label text-sm font-semibold" style={{ "--label": busy || filing ? "var(--ink-faint)" : color } as React.CSSProperties}>
                {busy
                  ? "Reading and summarizing…"
                  : filing
                    ? "Choosing a category…"
                    : (category?.name ?? "Uncategorized")}
              </p>
              <h1 className="mt-1 text-[clamp(1.6rem,3.5vw,var(--text-3xl))] leading-tight font-semibold tracking-tight text-pretty break-words">
                {b.title || hostOf(b.url)}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <TypeIcon type={b.type} className="size-4" />
                  {b.type === "web" ? (b.siteName ?? hostOf(b.url)) : TYPE_LABEL[b.type]}
                </span>
                {b.author ? <span>{b.author}</span> : null}
                <span>Saved {timeAgo(b.createdAt)}</span>
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <a href={b.url} target="_blank" rel="noopener noreferrer">
                    Open original
                    <ExternalLinkIcon data-icon="inline-end" />
                  </a>
                </Button>
                {b.content && b.type !== "tweet" ? (
                  <Button asChild variant="outline">
                    <Link href={`/library/${b.id}/read`}>
                      <BookOpenTextIcon data-icon="inline-start" />
                      Read saved copy
                      <span className="text-muted-foreground">· {readingMinutes(b.content)} min</span>
                    </Link>
                  </Button>
                ) : null}
              </div>
            </header>
          </div>

          {videoId ? (
            <div className="mt-8 aspect-video overflow-hidden rounded-xl bg-ink dark:bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={b.title ?? "YouTube video"}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="size-full"
              />
            </div>
          ) : b.imageUrl && b.type === "web" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.imageUrl} alt="" referrerPolicy="no-referrer" className="mt-8 max-h-80 w-full rounded-xl bg-rule object-cover" />
          ) : null}

          {b.type === "tweet" && b.content ? (
            <blockquote className="mt-8 border-l-2 pl-4 text-base leading-[1.65] text-pretty break-words whitespace-pre-line sm:pl-5 sm:text-[1.0625rem]">
              {b.content.slice(0, 4000)}
            </blockquote>
          ) : null}

          {b.linkStatus === "dead" ? (
            <Alert className="mt-8">
              <Link2OffIcon />
              <AlertTitle>The original page is gone</AlertTitle>
              <AlertDescription>
                <p>
                  It answered &ldquo;not found&rdquo; when checked{b.linkCheckedAt ? ` ${timeAgo(b.linkCheckedAt)}` : ""}.
                  {b.content ? " The text saved with this bookmark is still here." : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {b.content && b.type !== "tweet" ? (
                    <Button asChild size="sm">
                      <Link href={`/library/${b.id}/read`}>
                        <BookOpenTextIcon data-icon="inline-start" />
                        Read saved copy
                      </Link>
                    </Button>
                  ) : null}
                  <CheckLinkButton id={b.id} />
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {b.status === "failed" ? (
            <Alert variant="destructive" className="mt-8">
              <CircleAlertIcon />
              <AlertTitle>Couldn&apos;t process this one</AlertTitle>
              <AlertDescription>{b.error ?? "Processing failed."} Use “Summarize again” to retry.</AlertDescription>
            </Alert>
          ) : null}

          {b.summary ? (
            <section className="mt-10">
              <h2 className="text-sm font-semibold text-muted-foreground">Summary</h2>
              <p className="mt-2.5 max-w-[65ch] text-base leading-[1.7] text-pretty sm:text-[1.0625rem]">{b.summary}</p>
            </section>
          ) : null}

          {b.keyPoints?.length ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-muted-foreground">Key points</h2>
              <ul className="mt-2.5 flex max-w-[65ch] list-disc flex-col gap-2 pl-5 leading-[1.65] text-pretty marker:text-ink-faint">
                {b.keyPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {b.note ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-muted-foreground">What you highlighted</h2>
              <p className="mt-2.5 max-w-[65ch] leading-[1.65]">
                <mark>{b.note}</mark>
              </p>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-8 lg:sticky lg:top-6 lg:self-start lg:pt-2">
          <CategoryPicker
            bookmarkId={b.id}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            currentId={b.categoryId}
            locked={b.categoryLocked}
          />
          {b.tags.length ? (
            <div>
              <h2 className="text-sm font-medium">Tags</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {b.tags.map((t) => (
                  <li key={t}>
                    <Badge asChild variant="secondary">
                      <Link href={libraryHref("/library", { q: t })}>#{t}</Link>
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <BookmarkActions id={b.id} read={b.readAt !== null} ready={b.status === "ready"} />
        </aside>
      </div>

      <Suspense fallback={null}>
        <RelatedSection related={related} />
      </Suspense>
    </article>
  );
}

async function RelatedSection({ related }: { related: Promise<BookmarkListItem[]> }) {
  const items = await related;
  if (!items.length) return null;
  return (
    <section className="mt-14">
      <RelatedShelf
        items={items.map(({ id, url, title, type, siteName, categoryName, categoryColor }) => ({
          id,
          url,
          title,
          type,
          siteName,
          categoryName,
          categoryColor,
        }))}
      />
    </section>
  );
}
