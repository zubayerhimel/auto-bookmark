"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { BookmarkListItem } from "@/lib/bookmarks";
import { loadMoreBookmarksAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BookmarkRow, bookmarkListClass } from "./bookmark-row";

/**
 * The library list. The server renders the first page; later pages load as the end of the list
 * scrolls near, so a big library or category never has to arrive all at once.
 * Remount it (via `key`) when the filters or sort change.
 */
export function BookmarkFeed({
  items,
  nextCursor,
  filters,
  showUnread,
}: {
  items: BookmarkListItem[];
  nextCursor: string | null;
  /** The list's query string, passed back to the server to fetch more of the same list. */
  filters: string;
  showUnread: boolean;
}) {
  const [more, setMore] = useState<{ items: BookmarkListItem[]; cursor: string | null }>({ items: [], cursor: null });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // The first page refreshes while bookmarks are processing; until more is loaded, follow its cursor.
  const cursor = more.items.length ? more.cursor : nextCursor;
  const firstIds = new Set(items.map((i) => i.id));
  const all = [...items, ...more.items.filter((i) => !firstIds.has(i.id))];

  async function loadMore() {
    if (!cursor || busy.current) return;
    busy.current = true;
    setStatus("loading");
    try {
      const page = await loadMoreBookmarksAction(filters, cursor);
      setMore((m) => ({ items: [...m.items, ...page.items], cursor: page.nextCursor }));
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }

  const onNearEnd = useEffectEvent(() => void loadMore());

  // A fresh observer per page reports straight away if the end is still in view, so short pages keep filling.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || status === "error") return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onNearEnd(), {
      rootMargin: "0px 0px 800px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, status]);

  return (
    <>
      <ol className={`mt-5 ${bookmarkListClass}`}>
        {all.map((item) => (
          <BookmarkRow key={item.id} item={item} showUnread={showUnread} />
        ))}
      </ol>
      <div ref={sentinel} aria-live="polite" className="mt-6 flex min-h-10 items-center justify-center text-sm text-ink-faint">
        {status === "error" ? (
          <p className="flex items-center gap-3">
            More bookmarks didn&apos;t load.
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              Try again
            </Button>
          </p>
        ) : status === "loading" ? (
          <p className="flex items-center gap-2">
            <Spinner />
            Loading more bookmarks
          </p>
        ) : cursor ? (
          <Button variant="ghost" size="sm" onClick={() => void loadMore()} className="text-ink-soft">
            Show more
          </Button>
        ) : more.items.length ? (
          <p>That&apos;s everything.</p>
        ) : null}
      </div>
    </>
  );
}
