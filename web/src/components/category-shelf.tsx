import Link from "next/link";
import type { CSSProperties } from "react";

type Cat = { id: string; name: string; slug: string; color: string; count: number };

/** The user's categories as hanging ribbons, longest for the fullest. Each opens that category. */
export function CategoryShelf({ categories }: { categories: Cat[] }) {
  const sorted = [...categories].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const max = Math.max(1, ...sorted.map((c) => c.count));

  return (
    <figure>
      {/* The rod. Ribbons sit tucked behind it (clipped by the scroller); hovering pulls one down. */}
      <div className="-mx-4 overflow-x-auto border-t-2 border-ink px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max items-start gap-2 sm:gap-2.5">
          {sorted.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/library?category=${c.slug}`}
                title={`${c.name}: ${c.count} ${c.count === 1 ? "bookmark" : "bookmarks"}`}
                className="shelf-ribbon flex w-10 flex-col items-center justify-between pt-5 pb-5 text-white -translate-y-1.5 transition-[translate] duration-200 ease-out hover:translate-y-0 focus-visible:translate-y-0 focus-visible:outline-none focus-visible:[&>span:first-child]:underline motion-reduce:transition-none sm:w-11"
                style={
                  {
                    "--r": c.count / max,
                    "--i": i,
                    minHeight: `calc(${Math.min(c.name.length, 28)} * 0.5rem + 4rem)`,
                    background: c.color,
                  } as CSSProperties
                }
              >
                <span className="max-h-[14rem] overflow-hidden text-[0.8125rem] font-semibold text-ellipsis whitespace-nowrap [writing-mode:vertical-rl]">
                  {c.name}
                </span>
                <span className="text-xs font-medium tabular-nums opacity-85">
                  {c.count}
                  <span className="sr-only"> bookmarks</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-2 text-sm text-ink-faint">
        Longer ribbons hold more bookmarks. Pick one to open it.
      </figcaption>
    </figure>
  );
}
