"use client";

import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { libraryHref } from "@/lib/search-params";

type Tag = { tag: string; count: number };

/** Every tag as a link to its bookmarks, filterable and sortable. */
export function TagCloud({ tags }: { tags: Tag[] }) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<"count" | "name">("count");
  const q = useDeferredValue(query.trim().toLowerCase().replace(/^#+/, ""));

  const shown = tags.filter((t) => t.tag.includes(q));
  if (order === "name") shown.sort((a, b) => a.tag.localeCompare(b.tag));

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="bg-card sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a tag"
            aria-label="Find a tag"
            type="search"
          />
        </InputGroup>
        <Tabs value={order} onValueChange={(v) => setOrder(v as typeof order)}>
          <TabsList>
            <TabsTrigger value="count">Most used</TabsTrigger>
            <TabsTrigger value="name">A–Z</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {shown.length ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {shown.map((t) => (
            <li key={t.tag}>
              <Link
                href={libraryHref("/library", { tag: t.tag })}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-rule bg-card px-3 text-sm font-medium transition-colors duration-150 ease-out hover:border-ink/25 hover:text-action focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                #{t.tag}
                <span className="text-xs text-ink-faint tabular-nums">{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-ink-soft">No tags match &ldquo;{query.trim()}&rdquo;.</p>
      )}
    </div>
  );
}
