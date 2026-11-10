import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ChevronRightIcon, CircleAlertIcon, ExternalLinkIcon } from "lucide-react";
import { BookmarkActions } from "@/components/bookmark-actions";
import { BookmarkRow } from "@/components/bookmark-row";
import { AutoRefresh } from "@/components/auto-refresh";
import { CategoryPicker } from "@/components/category-picker";
import { TypeIcon } from "@/components/type-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { getBookmark, listCategoriesWithCounts, relatedBookmarks } from "@/lib/bookmarks";
import { youtubeId } from "@/lib/extract";
import { hostOf, timeAgo, TYPE_LABEL } from "@/lib/format";
import { requireUser } from "@/lib/session";

export default async function BookmarkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const row = await getBookmark(user.id, id);
  if (!row) notFound();
  const { bookmark: b, category } = row;
  const [categories, related] = await Promise.all([
    listCategoriesWithCounts(user.id),
    relatedBookmarks(user.id, id),
  ]);

  const busy = b.status === "pending" || b.status === "processing";
  const videoId = b.type === "youtube" ? youtubeId(b.url) : null;
  const color = category?.color ?? "var(--rule)";

  return (
    <article className="mx-auto max-w-5xl">
      <AutoRefresh active={busy} />
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/library">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to library
        </Link>
      </Button>

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <div className="grid grid-cols-[5px_minmax(0,1fr)] gap-4 sm:gap-5">
            <span aria-hidden className={`rounded-full ${busy ? "ribbon-pending" : ""}`} style={busy ? undefined : { background: color }} />
            <header>
              <p className="text-sm font-semibold" style={{ color: busy ? "var(--ink-faint)" : color }}>
                {busy ? "Reading and summarizing…" : (category?.name ?? "Uncategorized")}
              </p>
              <h1 className="mt-1 text-[clamp(1.6rem,3.5vw,var(--text-3xl))] leading-tight font-bold tracking-tight text-pretty break-words">
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
              <Button asChild className="mt-5">
                <a href={b.url} target="_blank" rel="noopener noreferrer">
                  Open original
                  <ExternalLinkIcon data-icon="inline-end" />
                </a>
              </Button>
            </header>
          </div>

          {videoId ? (
            <div className="mt-8 aspect-video overflow-hidden rounded-xl bg-ink">
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
            <blockquote className="mt-8 border-l-2 pl-4 font-serif text-[1.0625rem] leading-relaxed break-words whitespace-pre-line sm:pl-5 sm:text-lg">
              {b.content.slice(0, 4000)}
            </blockquote>
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
              <p className="mt-2 max-w-[65ch] font-serif text-[1.0625rem] leading-[1.7] sm:text-lg">{b.summary}</p>
            </section>
          ) : null}

          {b.keyPoints?.length ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-muted-foreground">Key points</h2>
              <ul className="mt-2 max-w-[65ch] flex list-disc flex-col gap-1.5 pl-5 font-serif leading-relaxed marker:text-muted-foreground">
                {b.keyPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {b.note ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-muted-foreground">What you highlighted</h2>
              <p className="mt-2 max-w-[65ch] font-serif leading-relaxed">
                <mark>{b.note}</mark>
              </p>
            </section>
          ) : null}

          {b.content && b.type !== "tweet" ? (
            <Collapsible className="group/captured mt-8 max-w-[65ch]">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-2.5 text-muted-foreground">
                  <ChevronRightIcon data-icon="inline-start" className="transition-transform duration-200 ease-out group-data-[state=open]/captured:rotate-90" />
                  Text captured from the page
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="mt-3 font-serif text-sm leading-relaxed break-words whitespace-pre-line text-muted-foreground">
                  {b.content.slice(0, 6000)}
                  {b.content.length > 6000 ? "…" : ""}
                </p>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>

        <aside className="flex flex-col gap-8 lg:pt-1">
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
                      <Link href={`/library?q=${encodeURIComponent(t)}`}>#{t}</Link>
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <BookmarkActions id={b.id} />
        </aside>
      </div>

      {related.length ? (
        <section className="mt-16">
          <Separator className="mb-6" />
          <h2 className="text-lg font-bold tracking-tight">Close in meaning</h2>
          <ol className="divide-y divide-border">
            {related.map((item) => (
              <BookmarkRow key={item.id} item={item} />
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
