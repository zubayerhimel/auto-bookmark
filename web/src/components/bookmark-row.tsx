import Link from "next/link";
import type { BookmarkListItem } from "@/lib/bookmarks";
import { hostOf, timeAgo, TYPE_LABEL } from "@/lib/format";
import { Highlight } from "./highlight";
import { RowRibbon } from "./row-ribbon";
import { TypeIcon } from "./type-icon";

type Item = Omit<BookmarkListItem, "createdAt"> & { createdAt: Date | string };

export function BookmarkRow({ item, terms }: { item: Item; terms?: string[] }) {
  const busy = item.status === "pending" || item.status === "processing";
  const failed = item.status === "failed";
  const color = failed ? "var(--danger)" : (item.categoryColor ?? "var(--rule)");
  const title = item.title || hostOf(item.url);
  const blurb = item.summary || item.description;

  return (
    <li className="group relative grid grid-cols-[4px_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[4px_minmax(0,1fr)_auto] sm:gap-4">
      <RowRibbon busy={busy} color={color} />
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: busy ? "var(--ink-faint)" : color }}>
          {busy
            ? "Reading and summarizing…"
            : failed
              ? "Couldn't process this one"
              : (item.categoryName ?? "Uncategorized")}
        </p>
        <h3 className="mt-0.5 text-[1.05rem] leading-snug font-semibold text-pretty break-words">
          <Link
            href={`/library/${item.id}`}
            className="rounded-sm after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:text-action focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            <Highlight text={title} terms={terms} />
          </Link>
        </h3>
        {failed && item.error ? (
          <p className="mt-1 line-clamp-2 text-sm text-destructive">{item.error}</p>
        ) : blurb ? (
          <p className="mt-1 line-clamp-2 max-w-[68ch] font-serif text-[0.92rem] leading-relaxed text-muted-foreground">
            <Highlight text={blurb} terms={terms} />
          </p>
        ) : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" title={TYPE_LABEL[item.type]}>
            <TypeIcon type={item.type} />
            {item.type === "web" ? (item.siteName ?? hostOf(item.url)) : TYPE_LABEL[item.type]}
          </span>
          {item.author && item.type !== "web" ? <span className="truncate">{item.author}</span> : null}
          <time dateTime={new Date(item.createdAt).toISOString()}>{timeAgo(item.createdAt)}</time>
          {item.tags.slice(0, 4).map((tag) => (
            <span key={tag}>
              #<Highlight text={tag} terms={terms} />
            </span>
          ))}
        </p>
      </div>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="hidden h-[72px] w-[112px] rounded-md bg-rule object-cover sm:block"
        />
      ) : null}
    </li>
  );
}
