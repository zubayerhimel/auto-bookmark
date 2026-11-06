"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BookmarkListItem } from "@/lib/bookmarks";
import { BookmarkRow } from "./bookmark-row";

type Result = {
  results: (Omit<BookmarkListItem, "createdAt"> & { createdAt: string; score: number })[];
  understood: {
    searchText: string;
    type: "web" | "tweet" | "youtube" | null;
    category: string | null;
    savedAfter: string | null;
    savedBefore: string | null;
  } | null;
  terms: string[];
};

const TYPE_PLURAL = { web: "pages", tweet: "posts on X", youtube: "YouTube videos" } as const;

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function describe(u: NonNullable<Result["understood"]>) {
  const parts = [`Looking for ${u.type ? TYPE_PLURAL[u.type] : "anything"} about “${u.searchText}”`];
  if (u.category) parts.push(`in ${u.category}`);
  if (u.savedAfter && u.savedBefore) parts.push(`saved between ${fmtDate(u.savedAfter)} and ${fmtDate(u.savedBefore)}`);
  else if (u.savedAfter) parts.push(`saved after ${fmtDate(u.savedAfter)}`);
  else if (u.savedBefore) parts.push(`saved before ${fmtDate(u.savedBefore)}`);
  return parts.join(" ");
}

export function SearchPanel({ initialQuery, children }: { initialQuery: string; children: React.ReactNode }) {
  const [query, setQuery] = useState(initialQuery);
  const [answer, setAnswer] = useState<{ q: string; data: Result | null; error: string | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const searching = trimmed.length >= 2;
  const current = answer?.q === trimmed ? answer : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;
  const loading = searching && !current;

  useEffect(() => {
    const url = new URL(window.location.href);
    if (trimmed) url.searchParams.set("q", trimmed);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);

    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Search failed.");
        setAnswer({ q: trimmed, data: json, error: null });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAnswer({ q: trimmed, data: null, error: (err as Error).message });
        }
      }
    }, 450);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div>
      <div role="search" className="flex items-center gap-3 border-b-2 border-ink pb-3 focus-within:border-action">
        {loading ? (
          <LoaderCircle className="size-6 shrink-0 animate-spin text-action motion-reduce:animate-none" aria-hidden />
        ) : (
          <Search className="size-6 shrink-0 text-ink-faint" aria-hidden />
        )}
        <label htmlFor="library-search" className="sr-only">
          Search your bookmarks
        </label>
        <input
          ref={inputRef}
          id="library-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder="Describe what you're looking for"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-xl font-medium tracking-tight placeholder:text-ink-faint focus:outline-none sm:text-[1.75rem] [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="rounded-full p-1 text-ink-faint hover:bg-paper hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-5" />
          </button>
        ) : (
          <kbd className="hidden rounded border border-rule px-1.5 text-xs text-ink-faint sm:block">/</kbd>
        )}
      </div>

      {!searching ? (
        <>
          <p className="mt-2 text-sm text-ink-faint">
            Try “the video about sourdough starters” or “posts about TypeScript from last month”.
          </p>
          {children}
        </>
      ) : (
        <section aria-live="polite" aria-busy={loading} className="mt-3">
          {error ? (
            <p className="py-6 text-danger">{error}</p>
          ) : data ? (
            <>
              <p className="text-sm text-ink-faint">
                {data.understood ? `${describe(data.understood)}. ` : ""}
                {data.results.length === 0
                  ? ""
                  : `${data.results.length} ${data.results.length === 1 ? "match" : "matches"}, closest first.`}
              </p>
              {data.results.length === 0 ? (
                <div className="py-14">
                  <p className="text-lg font-semibold">Nothing matches that yet.</p>
                  <p className="mt-1 max-w-[52ch] text-ink-soft">
                    Describe it differently: who made it, what it helped you do, or a phrase you remember
                    from it.
                  </p>
                </div>
              ) : (
                <ol className="mt-2 divide-y divide-rule">
                  {data.results.map((item) => (
                    <BookmarkRow key={item.id} item={item} terms={data.terms} />
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p className="py-6 text-sm text-ink-faint">Searching…</p>
          )}
        </section>
      )}
    </div>
  );
}
