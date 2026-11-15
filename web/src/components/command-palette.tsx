"use client";

import {
  BookOpenIcon,
  CircleAlertIcon,
  FileUpIcon,
  HashIcon,
  KeyRoundIcon,
  LibraryIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  PuzzleIcon,
  SearchIcon,
  StarIcon,
  SunIcon,
  TagsIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { BookmarkType } from "@/db/schema";
import { addBookmarkAction } from "@/lib/actions";
import { isEditableTarget, isModShortcut, isSlash } from "@/lib/keyboard";
import { libraryHref } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { LogoMark } from "./logo";
import { Shortcut } from "./shortcut";
import { TypeIcon } from "./type-icon";

type Cat = { name: string; slug: string; color: string };
type Hit = { id: string; title: string | null; url: string; type: BookmarkType; siteName: string | null };
type SearchState = { q: string; hits: Hit[] | null; error: string | null };

const OPEN_EVENT = "command-palette:open";

/** Opens the palette from anywhere, e.g. a header button. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandPaletteButton() {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Search and jump" onClick={openCommandPalette}>
      <SearchIcon />
    </Button>
  );
}

/** "⌘ K" on Apple devices, "Ctrl K" elsewhere. Renders nothing on the server to avoid a mismatch. */
export function PaletteShortcut({ className }: { className?: string }) {
  return <Shortcut keys={["mod", "K"]} hideUntilKnown className={className} />;
}

/** Something that reads as a link: has a scheme, or is a single word with a dot like "example.com/page". */
function asLink(text: string) {
  if (/^https?:\/\/\S+$/i.test(text)) return text;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text)) return `https://${text}`;
  return null;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const PAGES = [
  { label: "All bookmarks", href: "/library", Icon: LibraryIcon, keywords: "library home everything" },
  { label: "To read", href: libraryHref("/library", { view: "unread" }), Icon: BookOpenIcon, keywords: "unread later queue" },
  { label: "Favorites", href: libraryHref("/library", { favorites: true }), Icon: StarIcon, keywords: "starred pinned saved important" },
  { label: "Manage categories", href: "/categories", Icon: TagsIcon, keywords: "folders rename" },
  { label: "Tags", href: "/tags", Icon: HashIcon, keywords: "labels topics hashtags" },
  { label: "Import bookmarks", href: "/import", Icon: FileUpIcon, keywords: "chrome firefox pocket raindrop upload" },
  { label: "Browser extension", href: "/extension", Icon: PuzzleIcon, keywords: "chrome connect token install" },
  { label: "AI settings", href: "/settings", Icon: KeyRoundIcon, keywords: "api key openai anthropic claude gemini openrouter model" },
];

const THEMES = [
  { value: "light", label: "Light theme", Icon: SunIcon },
  { value: "dark", label: "Dark theme", Icon: MoonIcon },
  { value: "system", label: "Match system theme", Icon: MonitorIcon },
];

function matches(query: string, ...fields: string[]) {
  const q = query.toLowerCase();
  return !q || fields.some((f) => f.toLowerCase().includes(q));
}

/** Small bordered tile holding a row's icon; lights up with the highlighted row. */
function ItemIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground group-data-selected/command-item:bg-background group-data-selected/command-item:text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ItemText({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{title}</span>
      {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
    </span>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col">
      <span role="status" className="sr-only">
        Searching
      </span>
      {["w-3/4", "w-1/2", "w-2/3"].map((width) => (
        <div key={width} aria-hidden className="flex h-12 items-center gap-3 px-2">
          <Skeleton className="size-7 rounded-md" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className={cn("h-3", width)} />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
      {label}
    </span>
  );
}

/** What Enter does for the highlighted row, shown in the footer. */
function enterLabel(value: string) {
  if (value.startsWith("save")) return "Save";
  if (value.startsWith("theme")) return "Apply";
  if (value.startsWith("bookmark") || value === "all-results") return "Open";
  return "Go";
}

export function CommandPalette({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [selected, setSelected] = useState("");
  const [shown, setShown] = useState<SearchState | null>(null);
  const [saving, startSaving] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const searching = trimmed.length >= 2;
  const current = search?.q === trimmed ? search : null;
  const link = asLink(trimmed);

  // Results arrive after the list has settled on another item; move the highlight to the best match.
  if (current !== shown) {
    setShown(current);
    if (current?.hits?.length) setSelected(`bookmark-${current.hits[0].id}`);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModShortcut(e, "k")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // On the library page "/" focuses its own search box; everywhere else it opens the palette.
      if (isSlash(e) && !isEditableTarget(e.target) && !document.getElementById("library-search")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open || !searching || link) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Search is unavailable right now.");
        setSearch({ q: trimmed, hits: (json.results as Hit[]).slice(0, 8), error: null });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSearch({ q: trimmed, hits: null, error: (err as Error).message });
        }
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, searching, trimmed, link]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const save = (url: string) => {
    startSaving(async () => {
      const form = new FormData();
      form.set("url", url);
      const result = await addBookmarkAction(null, form);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result?.message ?? "Saved.");
      onOpenChange(false);
    });
  };

  const pages = PAGES.filter((p) => matches(trimmed, p.label, p.keywords));
  const cats = categories.filter((c) => matches(trimmed, c.name));
  const themes = THEMES.filter((t) => t.value !== theme && matches(trimmed, t.label, "theme appearance mode"));
  const pending = searching && !link && !current;
  const hits = current?.hits ?? [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search and jump"
      description="Search your bookmarks, go to a page, or save a link."
      className="sm:max-w-xl"
    >
      <Command shouldFilter={false} loop value={selected} onValueChange={setSelected}>
        <CommandInput
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          placeholder="Search bookmarks, jump to a page, or paste a link"
        >
          {query ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <XIcon />
            </Button>
          ) : null}
        </CommandInput>
        <CommandList className="max-h-[min(26rem,60vh)]">
          {link ? (
            <CommandGroup heading="Save">
              <CommandItem value="save-link" disabled={saving} onSelect={() => save(link)}>
                <ItemIcon className="border-transparent bg-primary text-primary-foreground group-data-selected/command-item:text-primary-foreground">
                  {saving ? <Spinner /> : <PlusIcon />}
                </ItemIcon>
                <ItemText title={saving ? "Saving to your library…" : "Save to your library"} detail={hostOf(link)} />
              </CommandItem>
            </CommandGroup>
          ) : null}

          {searching && !link ? (
            <CommandGroup heading="Bookmarks">
              {pending ? (
                <SearchSkeleton />
              ) : current?.error ? (
                <CommandItem value="search-error" disabled>
                  <ItemIcon>
                    <CircleAlertIcon />
                  </ItemIcon>
                  <ItemText title={current.error} />
                </CommandItem>
              ) : (
                hits.map((hit) => (
                  <CommandItem key={hit.id} value={`bookmark-${hit.id}`} onSelect={() => go(`/library/${hit.id}`)}>
                    <ItemIcon>
                      <TypeIcon type={hit.type} className="size-4" />
                    </ItemIcon>
                    <ItemText title={hit.title || hit.url} detail={hit.siteName ?? hostOf(hit.url)} />
                  </CommandItem>
                ))
              )}
              {!pending && !current?.error ? (
                hits.length ? (
                  <CommandItem value="all-results" onSelect={() => go(libraryHref("/library", { q: trimmed }))}>
                    <ItemIcon>
                      <SearchIcon />
                    </ItemIcon>
                    <ItemText title={`See all results for “${trimmed}”`} />
                  </CommandItem>
                ) : (
                  <CommandItem value="no-results" disabled>
                    <ItemIcon>
                      <SearchIcon />
                    </ItemIcon>
                    <ItemText title={`No bookmarks match “${trimmed}”`} />
                  </CommandItem>
                )
              ) : null}
            </CommandGroup>
          ) : null}

          {pages.length ? (
            <CommandGroup heading="Go to">
              {pages.map(({ label, href, Icon }) => (
                <CommandItem key={label} value={`page-${label}`} onSelect={() => go(href)}>
                  <ItemIcon>
                    <Icon />
                  </ItemIcon>
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {cats.length ? (
            <CommandGroup heading="Categories">
              {cats.map((c) => (
                <CommandItem key={c.slug} value={`category-${c.slug}`} onSelect={() => go(libraryHref("/library", { category: c.slug }))}>
                  <ItemIcon>
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                  </ItemIcon>
                  <span className="min-w-0 truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {themes.length ? (
            <CommandGroup heading="Appearance">
              {themes.map(({ value, label, Icon }) => (
                <CommandItem
                  key={value}
                  value={`theme-${value}`}
                  onSelect={() => {
                    setTheme(value);
                    onOpenChange(false);
                  }}
                >
                  <ItemIcon>
                    <Icon />
                  </ItemIcon>
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {pending ? null : (
            <CommandEmpty className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <SearchIcon className="size-5" />
              Nothing here matches “{trimmed}”.
            </CommandEmpty>
          )}
        </CommandList>
        <div className="hidden h-10 shrink-0 items-center gap-4 border-t px-3 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-2 font-medium">
            <LogoMark className="size-4" />
            Auto Bookmark
          </span>
          <span className="ml-auto flex items-center gap-4">
            <KeyHint keys={["↑", "↓"]} label="Navigate" />
            <KeyHint keys={["↵"]} label={enterLabel(selected)} />
            <KeyHint keys={["Esc"]} label="Close" />
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
