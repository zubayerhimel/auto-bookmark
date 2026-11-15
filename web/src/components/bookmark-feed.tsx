"use client";

import { CheckSquareIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import type { BookmarkListItem } from "@/lib/bookmarks";
import { loadMoreBookmarksAction, type BulkOperation } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BookmarkRow, bookmarkListClass } from "./bookmark-row";
import { SelectionBar, type CategoryOption } from "./selection-bar";

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
  categories,
  toolbar,
}: {
  items: BookmarkListItem[];
  nextCursor: string | null;
  /** The list's query string, passed back to the server to fetch more of the same list. */
  filters: string;
  showUnread: boolean;
  /** Where selected bookmarks can be moved. */
  categories: CategoryOption[];
  /** Controls shown beside "Select" above the list. */
  toolbar?: ReactNode;
}) {
  const [more, setMore] = useState<{ items: BookmarkListItem[]; cursor: string | null }>({ items: [], cursor: null });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const lastToggled = useRef<number | null>(null);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // The first page refreshes while bookmarks are processing; until more is loaded, follow its cursor.
  const cursor = more.items.length ? more.cursor : nextCursor;
  const firstIds = new Set(items.map((i) => i.id));
  const all = [...items, ...more.items.filter((i) => !firstIds.has(i.id))];
  // Cards can vanish under a selection (deleted elsewhere, or a refresh), so count only those still here.
  const selectedIds = all.filter((i) => selected.has(i.id)).map((i) => i.id);

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    lastToggled.current = null;
  }

  function toggle(index: number, range: boolean) {
    const id = all[index].id;
    const from = lastToggled.current;
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && from !== null) {
        const on = !prev.has(id);
        for (let i = Math.min(from, index); i <= Math.max(from, index); i++) {
          if (on) next.add(all[i].id);
          else next.delete(all[i].id);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastToggled.current = index;
  }

  /** The server refresh redraws the first page; cards loaded since are patched here. */
  function applyLocally(ids: string[], op: BulkOperation) {
    const hit = new Set(ids);
    const category = op.kind === "move" ? categories.find((c) => c.id === op.categoryId) : undefined;
    setMore((m) => ({
      ...m,
      items:
        op.kind === "delete"
          ? m.items.filter((i) => !hit.has(i.id))
          : m.items.map((i) => {
              if (!hit.has(i.id)) return i;
              if (op.kind === "read") return { ...i, readAt: i.readAt ?? new Date() };
              if (op.kind === "unread") return { ...i, readAt: null };
              if (op.kind === "favorite") return { ...i, favoritedAt: i.favoritedAt ?? new Date() };
              if (op.kind === "unfavorite") return { ...i, favoritedAt: null };
              return category
                ? { ...i, categoryId: category.id, categoryName: category.name, categoryColor: category.color, categoryLocked: true }
                : i;
            }),
    }));
  }

  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    // Leave Escape to an open menu or dialog first.
    if (e.key !== "Escape" || document.querySelector("[role=dialog],[role=alertdialog],[role=menu]")) return;
    stopSelecting();
  });
  useEffect(() => {
    if (!selecting) return;
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [selecting]);

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
      <div className="mt-3 flex items-center justify-end gap-2">
        {selecting ? null : (
          <Button type="button" variant="ghost" size="sm" className="text-ink-soft" onClick={() => setSelecting(true)}>
            <CheckSquareIcon data-icon="inline-start" />
            Select
          </Button>
        )}
        {toolbar}
      </div>
      <ol className={`mt-3 ${bookmarkListClass}`}>
        {all.map((item, index) => (
          <BookmarkRow
            key={item.id}
            item={item}
            showUnread={showUnread}
            selection={selecting ? { selected: selected.has(item.id), onToggle: (range) => toggle(index, range) } : undefined}
            menu={{ categories, onApplied: applyLocally }}
          />
        ))}
      </ol>
      {selecting ? (
        <SelectionBar
          ids={selectedIds}
          total={all.length}
          categories={categories}
          onSelectAll={() => setSelected(new Set(all.map((i) => i.id)))}
          onDone={stopSelecting}
          onApplied={applyLocally}
        />
      ) : null}
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
