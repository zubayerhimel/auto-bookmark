import type { CSSProperties } from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookmarkIcon, CheckIcon, FileText, MessageSquareText, MonitorPlay, SearchIcon } from "lucide-react";
import { Highlight } from "@/components/highlight";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

// Sorted longest first, so the shortest ribbons leave room for the caption.
const shelf = [
  { name: "Databases", count: 48, color: "#2446C7" },
  { name: "Interview prep", count: 37, color: "#C2410C" },
  { name: "Typography", count: 31, color: "#7C3AED" },
  { name: "Running", count: 22, color: "#15803D" },
  { name: "Climate", count: 18, color: "#0F766E" },
  { name: "Home office", count: 12, color: "#0369A1" },
  { name: "Sourdough", count: 3, color: "#B45309" },
];

const query = "something about why databases use B-trees, I saved it in the spring";

const understood = [
  { label: "About", value: "why databases use B-trees" },
  { label: "Kind", value: "Anything" },
  { label: "Saved", value: "Between Mar 1 and May 31" },
];

const demoResults = [
  {
    category: "Databases",
    color: "#2446C7",
    icon: MonitorPlay,
    title: "B-Trees and LSM Trees, explained with a library card catalog",
    summary:
      "Why most databases index with B-trees: page-sized nodes keep disk reads few. LSM trees trade some read speed for much faster writes, which is why write-heavy stores prefer them.",
    source: "YouTube",
    when: "Saved Apr 12",
    hits: ["B-trees", "databases"],
  },
  {
    category: "Databases",
    color: "#2446C7",
    icon: FileText,
    title: "Your index is a tree, and that's the point",
    summary:
      "A short essay on how B-tree fan-out keeps lookups to three or four page reads even for billions of rows.",
    source: "blog.jcole.us",
    when: "Saved May 3",
    hits: ["B-tree"],
  },
  {
    category: "Interview prep",
    color: "#C2410C",
    icon: MessageSquareText,
    title: "Thread: data structures every backend engineer should know",
    summary: "Eight structures with one-line reasons, starting with B-trees and ending with Bloom filters.",
    source: "Post on X",
    when: "Saved Mar 20",
    hits: ["B-trees"],
  },
];

function AuthButtons({ next, size = "lg" }: { next: string; size?: "lg" | "default" }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SignUpButton mode="redirect" forceRedirectUrl={next} signInForceRedirectUrl={next}>
        <Button size={size} className={size === "lg" ? "h-12 rounded-full px-7 text-base" : "rounded-full px-5"}>
          Create your library
        </Button>
      </SignUpButton>
      <SignInButton mode="redirect" forceRedirectUrl={next} signUpForceRedirectUrl={next}>
        <Button size={size} variant="ghost" className={size === "lg" ? "h-12 rounded-full px-5 text-base" : "rounded-full px-4"}>
          Sign in
        </Button>
      </SignInButton>
    </div>
  );
}

function Shelf() {
  return (
    <figure className="relative sm:flex sm:items-end sm:gap-8 lg:block lg:pr-1">
      <ul className="flex shrink-0 items-start justify-between gap-1.5 overflow-hidden border-t-2 border-ink sm:justify-start sm:gap-3 lg:gap-3.5 lg:border-t-0">
        {shelf.map((c, i) => {
          const fresh = i === shelf.length - 1;
          return (
            <li
              key={c.name}
              className="ribbon flex w-[13%] max-w-11 flex-col items-center justify-between pt-3 pb-5 text-white sm:w-11 lg:w-13 lg:max-w-none lg:pt-4 lg:pb-6"
              data-fresh={fresh || undefined}
              style={{ "--n": c.count, "--i": i, background: c.color } as CSSProperties}
            >
              <span className="text-[0.75rem] font-semibold whitespace-nowrap [writing-mode:vertical-rl] sm:text-[0.8125rem] lg:text-sm">
                {c.name}
              </span>
              <span className="text-[0.75rem] font-medium tabular-nums opacity-85">
                {c.count}
                <span className="sr-only"> bookmarks</span>
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="ribbon-caption mt-4 max-w-[30ch] text-sm leading-snug text-ink-soft sm:mt-0 lg:absolute lg:text-right lg:top-[24.5rem] lg:right-0 lg:mt-0 lg:w-60">
        Your categories, sized by how much you&apos;ve saved. Sourdough is new: it appeared when you saved a third
        bread video.
      </figcaption>
    </figure>
  );
}

function SearchDemo() {
  return (
    <section aria-labelledby="search-heading" className="border-y border-rule bg-card">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 id="search-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
          Search the way you remember
        </h2>
        <p className="mt-3 max-w-[56ch] text-ink-soft sm:text-lg">
          Describe what it was about, what kind of thing it was, or roughly when you saved it. Results match meaning,
          not just the words you typed.
        </p>

        <figure aria-label="Example search" className="mt-10 sm:mt-14">
          <div className="flex items-start gap-3 border-b-2 border-ink pb-4 sm:gap-5 sm:pb-6">
            <SearchIcon className="mt-1.5 size-5 shrink-0 text-ink-faint sm:mt-3 sm:size-7" aria-hidden />
            <p className="font-serif text-[1.35rem] leading-snug text-balance sm:text-[2.1rem] sm:leading-[1.25]">
              {query}
            </p>
          </div>

          <div className="mt-8 grid gap-8 sm:mt-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
            <div>
              <h3 className="text-sm font-semibold">Understood as</h3>
              <dl className="mt-3 grid grid-cols-[4rem_minmax(0,1fr)] gap-y-2 text-sm">
                {understood.map((u) => (
                  <div key={u.label} className="contents">
                    <dt className="text-ink-faint">{u.label}</dt>
                    <dd>{u.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <ol aria-label="Results" className="flex flex-col divide-y divide-rule">
              {demoResults.map((r) => (
                <li key={r.title} className="grid grid-cols-[4px_minmax(0,1fr)] gap-3 py-4 first:pt-0 sm:gap-4">
                  <span className="rounded-full" style={{ background: r.color }} aria-hidden />
                  <div className="min-w-0">
                    <p className="category-label text-xs font-semibold" style={{ "--label": r.color } as React.CSSProperties}>
                      {r.category}
                    </p>
                    <p className="mt-0.5 text-[1.05rem] leading-snug font-semibold">
                      <Highlight text={r.title} terms={r.hits} />
                    </p>
                    <p className="mt-1 max-w-[68ch] font-serif text-[0.92rem] leading-relaxed text-ink-soft">
                      <Highlight text={r.summary} terms={r.hits} />
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <r.icon className="size-3.5" aria-hidden />
                        {r.source}
                      </span>
                      <span>{r.when}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </figure>
      </div>
    </section>
  );
}

function SaveTimeline() {
  return (
    <section aria-labelledby="timeline-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <h2 id="timeline-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
        What happens when you click save
      </h2>

      <ol className="mt-10 grid gap-10 sm:mt-14 md:grid-cols-3 md:gap-8">
        <li className="flex flex-col">
          <p className="border-t-2 border-ink pt-3 text-sm font-semibold tabular-nums">0 seconds</p>
          <div aria-hidden className="mt-5 flex h-11 items-center gap-2 rounded-full bg-card px-4 text-sm text-ink-faint shadow-[0_0_0_1px_var(--rule)]">
            <span className="min-w-0 flex-1 truncate">youtube.com/watch?v=Fo9…</span>
            <span className="relative grid size-7 place-items-center rounded-md bg-paper text-ink">
              <BookmarkIcon className="size-4" />
              <span className="absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full bg-[#15803D] text-white">
                <CheckIcon className="size-2.5" strokeWidth={3.5} />
              </span>
            </span>
          </div>
          <h3 className="mt-5 font-semibold">You save it</h3>
          <p className="mt-1 max-w-[42ch] text-sm text-ink-soft">
            Click the extension in your toolbar or press{" "}
            <KbdGroup>
              <Kbd className="bg-card text-ink shadow-[0_0_0_1px_var(--rule)]">Alt</Kbd>
              <Kbd className="bg-card text-ink shadow-[0_0_0_1px_var(--rule)]">Shift</Kbd>
              <Kbd className="bg-card text-ink shadow-[0_0_0_1px_var(--rule)]">S</Kbd>
            </KbdGroup>
            <span>. Right-click a link to save it without opening it.</span>
          </p>
        </li>

        <li className="flex flex-col">
          <p className="border-t-2 border-ink pt-3 text-sm font-semibold tabular-nums">A few seconds later</p>
          <div aria-hidden className="mt-5 grid h-11 grid-cols-[4px_minmax(0,1fr)] gap-3">
            <span className="ribbon-pending rounded-full" />
            <div className="min-w-0 self-center">
              <p className="text-xs font-semibold text-ink-faint">Reading and summarizing…</p>
              <p className="truncate text-sm font-semibold">B-Trees and LSM Trees, explained</p>
            </div>
          </div>
          <h3 className="mt-5 font-semibold">AI reads it</h3>
          <p className="mt-1 max-w-[42ch] text-sm text-ink-soft">
            It reads the article, the post, or the video&apos;s transcript, then writes a short summary, key points and
            tags.
          </p>
        </li>

        <li className="flex flex-col">
          <p className="border-t-2 border-ink pt-3 text-sm font-semibold tabular-nums">Done</p>
          <div aria-hidden className="mt-5 grid h-11 grid-cols-[4px_minmax(0,1fr)] gap-3">
            <span className="rounded-full bg-action" />
            <div className="min-w-0 self-center">
              <p className="text-xs font-semibold text-action">Databases</p>
              <p className="truncate text-sm font-semibold">B-Trees and LSM Trees, explained</p>
            </div>
          </div>
          <h3 className="mt-5 font-semibold">It&apos;s filed</h3>
          <p className="mt-1 max-w-[42ch] text-sm text-ink-soft">
            It goes under the category that fits, or a new one when nothing does. Rename, merge or move things
            whenever you like.
          </p>
        </li>
      </ol>
    </section>
  );
}

export function Landing({ next }: { next: string }) {
  return (
    <div className="overflow-x-clip">
      <div className="mx-auto grid max-w-6xl grid-cols-1 px-5 sm:px-8 lg:min-h-[42rem] lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-16">
        <header className="flex h-16 items-center lg:col-start-1 lg:row-start-1 lg:h-20">
          <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
            <LogoMark className="size-7" />
            Auto Bookmark
          </span>
          <ThemeToggle className="ml-auto" />
        </header>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Shelf />
        </div>

        <section className="pt-10 pb-16 sm:pt-14 lg:col-start-1 lg:row-start-2 lg:self-center lg:pt-0 lg:pb-24">
          <h1 className="text-[clamp(2.6rem,7.4vw,4.6rem)] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance">
            Save anything once. Find it by describing it.
          </h1>
          <p className="mt-6 max-w-[36rem] text-base leading-relaxed text-ink-soft sm:text-lg">
            One click saves the page, the post on X, or the YouTube video you&apos;re looking at. AI reads it, writes a
            short summary, and files it under a category that fits, adding new categories as your interests change.
          </p>
          <div className="mt-9">
            <AuthButtons next={next} />
          </div>
          <p className="mt-4 text-sm text-ink-faint">Works in Chrome, Edge, Brave and Arc.</p>
        </section>
      </div>

      <SearchDemo />
      <SaveTimeline />

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xl font-bold tracking-tight text-balance sm:text-2xl">
            Start with the next thing you want to keep.
          </p>
          <AuthButtons next={next} size="default" />
        </div>
      </footer>
    </div>
  );
}
