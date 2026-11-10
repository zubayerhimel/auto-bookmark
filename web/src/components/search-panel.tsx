"use client";

import { CircleAlertIcon, SearchIcon, SearchXIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BookmarkListItem } from "@/lib/bookmarks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { BookmarkRow, bookmarkListClass } from "./bookmark-row";

type Result = {
  results: (Omit<BookmarkListItem, "createdAt" | "readAt"> & {
    createdAt: string;
    readAt: string | null;
    score: number;
  })[];
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
      <div role="search">
        <label htmlFor="library-search" className="sr-only">
          Search your bookmarks
        </label>
        <InputGroup className="h-12 rounded-2xl bg-card shadow-[0_1px_2px_rgb(27_36_48/0.05)] sm:h-14">
          <InputGroupAddon className="pl-3.5">
            {loading ? <Spinner className="text-ring" /> : <SearchIcon />}
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Describe what you're looking for"
            autoComplete="off"
            enterKeyHint="search"
            className="text-base font-medium sm:text-lg [&::-webkit-search-cancel-button]:hidden"
          />
          <InputGroupAddon align="inline-end" className="pr-2.5">
            {query ? (
              <InputGroupButton
                size="icon-sm"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <XIcon />
              </InputGroupButton>
            ) : (
              <Kbd className="hidden sm:inline-flex">/</Kbd>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>

      {!searching ? (
        <>
          <p className="mt-2 px-1 text-sm text-muted-foreground">
            Try “the video about sourdough starters” or “posts about TypeScript from last month”.
          </p>
          {children}
        </>
      ) : (
        <section aria-live="polite" aria-busy={loading} className="mt-4">
          {error ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Search didn&apos;t work</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : data ? (
            <>
              <p className="px-1 text-sm text-muted-foreground">
                {data.understood ? `${describe(data.understood)}. ` : ""}
                {data.results.length === 0
                  ? ""
                  : `${data.results.length} ${data.results.length === 1 ? "match" : "matches"}, closest first.`}
              </p>
              {data.results.length === 0 ? (
                <Empty className="mt-6 border border-dashed bg-card">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchXIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nothing matches that yet</EmptyTitle>
                    <EmptyDescription>
                      Describe it differently: who made it, what it helped you do, or a phrase you remember from it.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ol className={`mt-4 ${bookmarkListClass}`}>
                  {data.results.map((item) => (
                    <BookmarkRow key={item.id} item={item} terms={data.terms} />
                  ))}
                </ol>
              )}
            </>
          ) : (
            <div className={`py-2 ${bookmarkListClass}`} aria-label="Searching">
              {[0, 1, 2].map((i) => (
                <div key={i} className="relative rounded-2xl border border-rule bg-card py-4 pr-4 pl-10 sm:pl-12">
                  <span aria-hidden className="ribbon-mark absolute -top-px left-4 h-9 w-2.5 bg-paper sm:left-5" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
