"use client";

import {
  BookOpenIcon,
  CircleAlertIcon,
  FileUpIcon,
  HashIcon,
  LibraryIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  PuzzleIcon,
  SearchIcon,
  SunIcon,
  TagsIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import type { BookmarkType } from "@/db/schema";
import { addBookmarkAction } from "@/lib/actions";
import { libraryHref } from "@/lib/search-params";
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
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
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

const noopSubscribe = () => () => {};

/** "⌘ K" on Apple devices, "Ctrl K" elsewhere. Renders nothing on the server to avoid a mismatch. */
export function PaletteShortcut({ className }: { className?: string }) {
  const mac = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => null,
  );
  if (mac === null) return null;
  return (
    <KbdGroup className={className}>
      <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  );
}

function isEditable(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
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
  { label: "Manage categories", href: "/categories", Icon: TagsIcon, keywords: "folders rename" },
  { label: "Tags", href: "/tags", Icon: HashIcon, keywords: "labels topics hashtags" },
  { label: "Import bookmarks", href: "/import", Icon: FileUpIcon, keywords: "chrome firefox pocket raindrop upload" },
  { label: "Browser extension", href: "/extension", Icon: PuzzleIcon, keywords: "chrome connect token install" },
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

export function CommandPalette({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [selected, setSelected] = useState("");
  const [shown, setShown] = useState<SearchState | null>(null);
  const [saving, startSaving] = useTransition();

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
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // On the library page "/" focuses its own search box; everywhere else it opens the palette.
      if (e.key === "/" && !isEditable(e.target) && !document.getElementById("library-search")) {
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
          value={query}
          onValueChange={setQuery}
          placeholder="Search bookmarks, jump to a page, or paste a link"
        />
        <CommandList className="max-h-[min(26rem,60vh)]">
          {link ? (
            <CommandGroup heading="Save">
              <CommandItem value="save-link" disabled={saving} onSelect={() => save(link)}>
                {saving ? <Spinner /> : <PlusIcon />}
                <span className="min-w-0 truncate">
                  {saving ? "Saving " : "Save "}
                  <span className="font-medium">{hostOf(link)}</span>
                </span>
              </CommandItem>
            </CommandGroup>
          ) : null}

          {searching && !link ? (
            <CommandGroup heading="Bookmarks">
              {pending ? (
                <CommandItem value="searching" disabled>
                  <Spinner />
                  Searching
                </CommandItem>
              ) : current?.error ? (
                <CommandItem value="search-error" disabled>
                  <CircleAlertIcon />
                  {current.error}
                </CommandItem>
              ) : (
                hits.map((hit) => (
                  <CommandItem key={hit.id} value={`bookmark-${hit.id}`} onSelect={() => go(`/library/${hit.id}`)}>
                    <TypeIcon type={hit.type} className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{hit.title || hit.url}</span>
                    <span className="max-w-[35%] shrink-0 truncate text-xs text-muted-foreground">
                      {hit.siteName ?? hostOf(hit.url)}
                    </span>
                  </CommandItem>
                ))
              )}
              {!pending && !current?.error ? (
                hits.length ? (
                  <CommandItem value="all-results" onSelect={() => go(libraryHref("/library", { q: trimmed }))}>
                    <SearchIcon />
                    <span className="min-w-0 truncate">See all results for “{trimmed}”</span>
                  </CommandItem>
                ) : (
                  <CommandItem value="no-results" disabled>
                    <SearchIcon />
                    <span className="min-w-0 truncate">No bookmarks match “{trimmed}”</span>
                  </CommandItem>
                )
              ) : null}
            </CommandGroup>
          ) : null}

          {pages.length ? (
            <CommandGroup heading="Go to">
              {pages.map(({ label, href, Icon }) => (
                <CommandItem key={label} value={`page-${label}`} onSelect={() => go(href)}>
                  <Icon />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {cats.length ? (
            <CommandGroup heading="Categories">
              {cats.map((c) => (
                <CommandItem key={c.slug} value={`category-${c.slug}`} onSelect={() => go(libraryHref("/library", { category: c.slug }))}>
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />
                  {c.name}
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
                  <Icon />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandEmpty>Nothing here matches “{trimmed}”.</CommandEmpty>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
