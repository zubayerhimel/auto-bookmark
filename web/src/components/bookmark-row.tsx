import type { BookmarkListItem } from "@/lib/bookmarks";
import { hostOf, timeAgo, TYPE_LABEL } from "@/lib/format";
import { Highlight } from "./highlight";
import { IntentLink } from "./intent-link";
import { RowRibbon } from "./row-ribbon";
import { Thumb } from "./thumb";
import { TypeIcon } from "./type-icon";

type Item = Omit<BookmarkListItem, "createdAt" | "readAt"> & {
  createdAt: Date | string;
  readAt: Date | string | null;
};

function previewOf(item: Item) {
  if (item.type === "youtube") {
    const id = item.url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)?.[1];
    if (id) return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  }
  return item.imageUrl;
}

/** One saved item: a sheet with its category ribbon hanging from the top edge. */
export function BookmarkRow({
  item,
  terms,
  showUnread = true,
}: {
  item: Item;
  terms?: string[];
  /** Off on the To read list, where every card is unread anyway. */
  showUnread?: boolean;
}) {
  const busy = item.status === "pending" || item.status === "processing";
  const filing = item.status === "ready" && !item.categoryId && !item.categoryLocked;
  const failed = item.status === "failed";
  const color = failed ? "var(--danger)" : (item.categoryColor ?? "var(--rule)");
  const title = item.title || hostOf(item.url);
  const blurb = item.summary || item.description;
  const preview = previewOf(item);
  const unread = showUnread && !item.readAt && item.status === "ready";

  return (
    <li className="group relative rounded-2xl border border-rule bg-card transition-[border-color] duration-150 ease-out hover:border-ink/25">
      {/* The ribbon sits a little tucked under the top edge and pulls down on hover. */}
      <span aria-hidden className="pointer-events-none absolute -top-px left-4 h-11 w-2.5 overflow-hidden sm:left-5">
        <RowRibbon
          busy={busy || filing}
          color={color}
          className="h-full w-full -translate-y-1.5 transition-[translate] duration-200 ease-out group-hover:translate-y-0 motion-reduce:transition-none"
        />
      </span>
      <div className="flex gap-5 py-4 pr-4 pl-10 sm:pr-4 sm:pl-12">
        <div className="min-w-0 flex-1">
          <p className="category-label text-xs font-semibold" style={{ "--label": busy || filing ? "var(--ink-faint)" : color } as React.CSSProperties}>
            {busy
              ? "Reading and summarizing…"
              : failed
                ? "Couldn't process this one"
                : filing
                  ? "Choosing a category…"
                  : (item.categoryName ?? "Uncategorized")}
          </p>
          <h3 className="mt-1 text-[1.0625rem] leading-snug font-semibold text-pretty break-words">
            <IntentLink
              href={`/library/${item.id}`}
              className="rounded-sm transition-colors duration-150 ease-out after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:text-action focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              <Highlight text={title} terms={terms} />
            </IntentLink>
          </h3>
          {failed && item.error ? (
            <p className="mt-1 line-clamp-2 text-sm text-destructive">{item.error}</p>
          ) : blurb ? (
            <p className="mt-1.5 line-clamp-2 max-w-[68ch] font-serif text-[0.92rem] leading-relaxed text-ink-soft">
              <Highlight text={blurb} terms={terms} />
            </p>
          ) : null}
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
            <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-ink-soft" title={TYPE_LABEL[item.type]}>
              <TypeIcon type={item.type} />
              <span className="truncate">
                {item.type === "web" ? (item.siteName ?? hostOf(item.url)) : TYPE_LABEL[item.type]}
              </span>
            </span>
            {item.author && item.type !== "web" ? <span className="truncate">{item.author}</span> : null}
            {unread ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-action">
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                To read
              </span>
            ) : null}
            <time dateTime={new Date(item.createdAt).toISOString()}>{timeAgo(item.createdAt)}</time>
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag}>
                #<Highlight text={tag} terms={terms} />
              </span>
            ))}
          </p>
        </div>
        {preview ? <Thumb src={preview} className="hidden aspect-[16/10] w-32 shrink-0 self-start sm:block" /> : null}
      </div>
    </li>
  );
}

/** The list the cards stack in. */
export const bookmarkListClass = "flex flex-col gap-2.5";
