import Link from "next/link";
import type { CSSProperties } from "react";

type Cat = { id: string; name: string; slug: string; color: string; count: number };

/*
 * Ribbon slots per container width (each ribbon is 44px plus a 10px gap). When categories outnumber
 * the slots, the last slot becomes a "+N more" ribbon pointing at the full list below.
 * Class names are spelled out so Tailwind can find them.
 */
const TIERS = [
  { slots: 5, showFrom: "", moreOnly: "@md:hidden", hideFrom: "@md:hidden" },
  { slots: 8, showFrom: "hidden @md:flex", moreOnly: "hidden @md:inline @xl:hidden", hideFrom: "@xl:hidden" },
  { slots: 10, showFrom: "hidden @xl:flex", moreOnly: "hidden @xl:inline @2xl:hidden", hideFrom: "@2xl:hidden" },
  { slots: 12, showFrom: "hidden @2xl:flex", moreOnly: "hidden @2xl:inline", hideFrom: "" },
];

/** The user's biggest categories as hanging ribbons, longest for the fullest. Each opens that category. */
export function CategoryShelf({ categories, moreHref }: { categories: Cat[]; moreHref: string }) {
  const sorted = [...categories].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = sorted.length;
  const max = Math.max(1, ...sorted.map((c) => c.count));
  // How many ribbons fit at each width, keeping one slot for "more" when needed.
  const visible = TIERS.map((t) => (total <= t.slots ? total : t.slots - 1));
  const shown = sorted.slice(0, visible[visible.length - 1]);
  const moreTiers = TIERS.map((t, i) => ({ ...t, rest: total - visible[i] })).filter((t) => t.rest > 0);
  // First width at which every category fits, so "more" can go.
  const lastMoreTier = TIERS.findIndex((t) => total <= t.slots);

  return (
    <figure className="@container">
      {/* The rod. Ribbons sit tucked behind it; hovering pulls one down. */}
      <div className="overflow-hidden border-t-2 border-ink">
        <ul className="flex items-start gap-2.5">
          {shown.map((c, i) => (
            <li key={c.id} className={TIERS.find((_, t) => i < visible[t])?.showFrom}>
              <Link
                href={`/library?category=${c.slug}`}
                title={`${c.name}: ${c.count} ${c.count === 1 ? "bookmark" : "bookmarks"}`}
                className="shelf-ribbon flex w-11 -translate-y-1.5 flex-col items-center justify-between py-5 text-white transition-[translate] duration-200 ease-out hover:translate-y-0 focus-visible:translate-y-0 focus-visible:outline-none focus-visible:[&>span:first-child]:underline motion-reduce:transition-none"
                style={
                  {
                    "--r": c.count / max,
                    "--i": i,
                    minHeight: `calc(${Math.min(c.name.length, 24)} * 0.55rem + 4.5rem)`,
                    background: c.color,
                  } as CSSProperties
                }
              >
                <span className="max-h-[13rem] shrink-0 overflow-hidden text-[0.8125rem] font-semibold text-ellipsis whitespace-nowrap [writing-mode:vertical-rl]">
                  {c.name}
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums opacity-85">
                  {c.count}
                  <span className="sr-only"> bookmarks</span>
                </span>
              </Link>
            </li>
          ))}
          {moreTiers.length ? (
            <li className={lastMoreTier > 0 ? TIERS[lastMoreTier - 1].hideFrom : undefined}>
              <Link
                href={moreHref}
                className="shelf-ribbon flex min-h-36 w-11 -translate-y-1.5 items-start justify-center bg-rule py-5 text-ink-soft transition-[translate,color] duration-200 ease-out [--r:0] hover:translate-y-0 hover:text-ink focus-visible:translate-y-0 focus-visible:outline-none focus-visible:[&>span]:underline motion-reduce:transition-none"
                style={{ "--i": shown.length } as CSSProperties}
              >
                {moreTiers.map((t) => (
                  <span
                    key={t.slots}
                    className={`${t.moreOnly} text-[0.8125rem] font-semibold whitespace-nowrap [writing-mode:vertical-rl]`}
                  >
                    +{t.rest} more
                  </span>
                ))}
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
      <figcaption className="mt-2 text-sm text-ink-faint">
        Longer ribbons hold more bookmarks. Pick one to open it.
      </figcaption>
    </figure>
  );
}
