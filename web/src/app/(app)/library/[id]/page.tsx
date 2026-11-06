import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { BookmarkActions } from "@/components/bookmark-actions";
import { BookmarkRow } from "@/components/bookmark-row";
import { AutoRefresh } from "@/components/auto-refresh";
import { CategoryPicker } from "@/components/category-picker";
import { TypeIcon } from "@/components/type-icon";
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
      <Link href="/library" className="text-sm text-ink-soft hover:text-ink">
        Back to library
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <div className="grid grid-cols-[5px_1fr] gap-5">
            <span aria-hidden className={`rounded-full ${busy ? "ribbon-pending" : ""}`} style={busy ? undefined : { background: color }} />
            <header>
              <p className="text-sm font-semibold" style={{ color: busy ? "var(--ink-faint)" : color }}>
                {busy ? "Reading and summarizing…" : (category?.name ?? "Uncategorized")}
              </p>
              <h1 className="mt-1 text-[clamp(1.6rem,3.5vw,var(--text-3xl))] leading-tight font-bold tracking-tight text-pretty">
                {b.title || hostOf(b.url)}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <TypeIcon type={b.type} className="size-4" />
                  {b.type === "web" ? (b.siteName ?? hostOf(b.url)) : TYPE_LABEL[b.type]}
                </span>
                {b.author ? <span>{b.author}</span> : null}
                <span>Saved {timeAgo(b.createdAt)}</span>
              </p>
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-action"
              >
                Open original
                <ExternalLink className="size-4" aria-hidden />
              </a>
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
            <blockquote className="mt-8 border-l-2 border-rule pl-5 font-serif text-lg leading-relaxed whitespace-pre-line">
              {b.content.slice(0, 4000)}
            </blockquote>
          ) : null}

          {b.status === "failed" ? (
            <p className="mt-8 rounded-lg bg-danger/5 px-4 py-3 text-sm text-danger">
              {b.error ?? "Processing failed."} Use “Summarize again” to retry.
            </p>
          ) : null}

          {b.summary ? (
            <section className="mt-10">
              <h2 className="text-sm font-semibold text-ink-soft">Summary</h2>
              <p className="mt-2 max-w-[65ch] font-serif text-lg leading-[1.7]">{b.summary}</p>
            </section>
          ) : null}

          {b.keyPoints?.length ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-ink-soft">Key points</h2>
              <ul className="mt-2 max-w-[65ch] list-disc space-y-1.5 pl-5 font-serif leading-relaxed marker:text-ink-faint">
                {b.keyPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {b.note ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-ink-soft">What you highlighted</h2>
              <p className="mt-2 max-w-[65ch] font-serif leading-relaxed">
                <mark>{b.note}</mark>
              </p>
            </section>
          ) : null}

          {b.content && b.type !== "tweet" ? (
            <details className="mt-8 max-w-[65ch]">
              <summary className="cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">
                Text captured from the page
              </summary>
              <p className="mt-3 font-serif text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                {b.content.slice(0, 6000)}
                {b.content.length > 6000 ? "…" : ""}
              </p>
            </details>
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
              <h2 className="text-sm font-semibold">Tags</h2>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
                {b.tags.map((t) => (
                  <Link key={t} href={`/library?q=${encodeURIComponent(t)}`} className="hover:text-action">
                    #{t}
                  </Link>
                ))}
              </p>
            </div>
          ) : null}
          <BookmarkActions id={b.id} />
        </aside>
      </div>

      {related.length ? (
        <section className="mt-16 border-t border-rule pt-6">
          <h2 className="text-lg font-bold tracking-tight">Close in meaning</h2>
          <ol className="divide-y divide-rule">
            {related.map((item) => (
              <BookmarkRow key={item.id} item={item} />
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
