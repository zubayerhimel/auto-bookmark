import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { RefreshCopyButton } from "@/components/refresh-copy-button";
import { Button } from "@/components/ui/button";
import { getBookmark } from "@/lib/bookmarks";
import { MAX_CONTENT_CHARS } from "@/lib/extract";
import { hostOf } from "@/lib/format";
import { looksFlattened, readerBlocks, readingMinutes } from "@/lib/reader";
import { requireUser } from "@/lib/session";

const loadBookmark = cache(getBookmark);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  const row = await loadBookmark(user.id, (await params).id);
  return { title: row?.bookmark.title ? `Read: ${row.bookmark.title}` : "Saved copy" };
}

/** Reader view: the text saved with the bookmark, readable even if the page changes or goes away. */
export default async function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const row = await loadBookmark(user.id, id);
  if (!row) notFound();
  const b = row.bookmark;
  const content = b.content ?? "";
  const blocks = readerBlocks(content);

  return (
    <article className="mx-auto max-w-[68ch]">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/library/${b.id}`}>
          <ArrowLeftIcon data-icon="inline-start" />
          Back to bookmark
        </Link>
      </Button>

      <header className="mt-6 border-b border-rule pb-6">
        <p className="text-sm text-muted-foreground">
          {[b.siteName ?? hostOf(b.url), b.author, content ? `${readingMinutes(content)} min read` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] leading-tight font-semibold tracking-tight text-pretty break-words">
          {b.title || hostOf(b.url)}
        </h1>
        <Button asChild variant="outline" size="sm" className="mt-5">
          <a href={b.url} target="_blank" rel="noopener noreferrer">
            Open original
            <ExternalLinkIcon data-icon="inline-end" />
          </a>
        </Button>
      </header>

      {!blocks.length ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p className="text-ink-soft">No text was saved for this page.</p>
          <RefreshCopyButton id={b.id} />
        </div>
      ) : (
        <>
          {looksFlattened(content) ? (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-rule bg-card px-5 py-4">
              <p className="text-sm leading-relaxed text-ink-soft">
                This copy was saved before paragraphs were kept, so it runs together. Fetching the page again
                usually fixes it.
              </p>
              <RefreshCopyButton id={b.id} />
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-5 text-[1.0625rem] leading-[1.75] text-pretty break-words sm:text-lg">
            {blocks.map((block, i) =>
              block.kind === "heading" ? (
                <h2 key={i} className="mt-4 text-xl leading-snug font-semibold tracking-tight">
                  {block.text}
                </h2>
              ) : block.kind === "list" ? (
                <ul key={i} className="flex list-disc flex-col gap-2 pl-6 marker:text-ink-faint">
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{block.text}</p>
              ),
            )}
          </div>

          <footer className="mt-12 flex flex-col items-start gap-4 border-t border-rule pt-6 text-sm text-muted-foreground">
            <p>
              {content.length >= MAX_CONTENT_CHARS ? "The saved copy stops here; the rest is on the original page. " : ""}
              This is the text saved with the bookmark; images and formatting aren&apos;t kept.
            </p>
            <RefreshCopyButton id={b.id} variant="ghost" />
          </footer>
        </>
      )}
    </article>
  );
}
