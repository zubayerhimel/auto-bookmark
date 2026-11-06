"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Cat = { id: string; name: string; slug: string; color: string; count: number };

export function SidebarNav({
  categories,
  total,
  uncategorized,
}: {
  categories: Cat[];
  total: number;
  uncategorized: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === "/library" ? (params.get("category") ?? "all") : null;

  const item = (key: string, href: string, label: string, count: number, color?: string) => {
    const current = active === key;
    return (
      <li key={key}>
        <Link
          href={href}
          aria-current={current ? "page" : undefined}
          className={`relative flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors ${
            current ? "bg-white font-semibold text-ink shadow-[0_1px_0_var(--rule)]" : "text-ink-soft hover:bg-white/60 hover:text-ink"
          }`}
        >
          <span
            aria-hidden
            className="h-4 w-1 shrink-0 rounded-full"
            style={{ background: color ?? "transparent" }}
          />
          <span className="truncate">{label}</span>
          <span className="ml-auto pl-2 text-xs tabular-nums text-ink-faint">{count}</span>
        </Link>
      </li>
    );
  };

  return (
    <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {item("all", "/library", "All bookmarks", total, "var(--ink)")}
      {categories.map((c) => item(c.slug, `/library?category=${c.slug}`, c.name, c.count, c.color))}
      {uncategorized > 0 ? item("uncategorized", "/library?category=uncategorized", "Uncategorized", uncategorized, "var(--rule)") : null}
    </ul>
  );
}
