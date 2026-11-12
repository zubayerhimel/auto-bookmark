"use client";

import Link from "next/link";
import type { BookmarkListItem } from "@/lib/bookmarks";
import { hostOf, TYPE_LABEL } from "@/lib/format";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, useCarousel } from "@/components/ui/carousel";
import { RowRibbon } from "./row-ribbon";
import { TypeIcon } from "./type-icon";

type Item = Pick<
  BookmarkListItem,
  "id" | "url" | "title" | "type" | "siteName" | "categoryName" | "categoryColor"
>;

function Arrows() {
  const { canScrollPrev, canScrollNext } = useCarousel();
  // Everything fits: no arrows to press.
  if (!canScrollPrev && !canScrollNext) return null;
  return (
    <div className="flex gap-1.5">
      <CarouselPrevious className="static inset-auto my-0" />
      <CarouselNext className="static inset-auto my-0" />
    </div>
  );
}

function RelatedCard({ item }: { item: Item }) {
  const color = item.categoryColor ?? "var(--rule)";
  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-rule bg-card py-3.5 pr-4 pl-10 transition-[border-color] duration-150 ease-out hover:border-ink/25">
      <span aria-hidden className="pointer-events-none absolute -top-px left-4 h-9 w-2.5 overflow-hidden">
        <RowRibbon
          busy={false}
          color={color}
          className="h-full w-full -translate-y-1.5 transition-[translate] duration-200 ease-out group-hover:translate-y-0 motion-reduce:transition-none"
        />
      </span>
      <p className="category-label truncate text-xs font-semibold" style={{ "--label": color } as React.CSSProperties}>
        {item.categoryName ?? "Uncategorized"}
      </p>
      <h3 className="mt-1 line-clamp-2 leading-snug font-semibold text-pretty break-words">
        <Link
          href={`/library/${item.id}`}
          className="transition-colors duration-150 ease-out after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:text-action focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
        >
          {item.title || hostOf(item.url)}
        </Link>
      </h3>
      <p className="mt-auto flex min-w-0 items-center gap-1.5 pt-3 text-xs font-medium text-ink-soft">
        <TypeIcon type={item.type} />
        <span className="truncate">{item.type === "web" ? (item.siteName ?? hostOf(item.url)) : TYPE_LABEL[item.type]}</span>
      </p>
    </div>
  );
}

/** Bookmarks nearest in meaning, as one swipeable row of compact cards, closest first. */
export function RelatedShelf({ items }: { items: Item[] }) {
  return (
    <Carousel opts={{ align: "start" }} aria-labelledby="related-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="related-heading" className="text-lg font-semibold tracking-tight">
          Close in meaning
        </h2>
        <Arrows />
      </div>
      <CarouselContent className="mt-3 py-px">
        {items.map((item) => (
          <CarouselItem key={item.id} className="basis-[82%] sm:basis-[46%] lg:basis-[31%]">
            <RelatedCard item={item} />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
