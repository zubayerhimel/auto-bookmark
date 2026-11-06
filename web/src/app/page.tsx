import { redirect } from "next/navigation";
import { ArrowRightIcon, FileText, MessageSquareText, MonitorPlay, SearchIcon } from "lucide-react";
import { Highlight } from "@/components/highlight";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getUserId } from "@/lib/session";

const demoResults = [
  {
    category: "Databases",
    color: "#2446C7",
    icon: MonitorPlay,
    title: "B-Trees and LSM Trees, explained with a library card catalog",
    summary:
      "Why most databases index with B-trees: page-sized nodes keep disk reads few. LSM trees trade some read speed for much faster writes, which is why write-heavy stores prefer them.",
    source: "YouTube",
    when: "Saved in April",
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
    when: "Saved in May",
    hits: ["B-tree"],
  },
  {
    category: "Software Engineering",
    color: "#0F766E",
    icon: MessageSquareText,
    title: "Thread: data structures every backend engineer should know",
    summary: "A list of eight structures with one-line reasons, starting with B-trees and ending with Bloom filters.",
    source: "Post on X",
    when: "Saved in March",
    hits: ["B-trees"],
  },
];

function safeNext(value: string | string[] | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/library";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getUserId()) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-8 sm:px-8">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">Auto Bookmark</span>
      </header>

      <section className="grid flex-1 items-center gap-10 py-10 sm:gap-12 sm:py-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="max-w-xl">
          <h1 className="text-[clamp(2.25rem,8vw,var(--text-4xl))] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance">
            Save anything once. Find it by describing it.
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            One click in your browser saves the page, the post on X, or the YouTube video you&apos;re
            looking at. AI reads it, writes a short summary, and files it under a category that
            fits, adding new categories as your interests change.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-9">
            <SignUpButton mode="redirect" forceRedirectUrl={next} signInForceRedirectUrl={next}>
              <Button size="lg" className="h-11 rounded-full px-6 text-base">
                Create your library
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </SignUpButton>
            <SignInButton mode="redirect" forceRedirectUrl={next} signUpForceRedirectUrl={next}>
              <Button size="lg" variant="ghost" className="h-11 rounded-full px-5 text-base">
                Sign in
              </Button>
            </SignInButton>
          </div>
        </div>

        <figure aria-label="Example search" className="min-w-0 rounded-2xl bg-card p-4 shadow-[0_1px_0_var(--rule),0_24px_48px_-28px_rgba(27,36,48,0.35)] sm:p-7">
          <div className="flex items-start gap-3 border-b-2 border-foreground pb-4">
            <SearchIcon className="mt-1 size-5 shrink-0 text-muted-foreground sm:mt-1.5" aria-hidden />
            <p className="text-lg leading-snug font-medium tracking-tight sm:text-2xl">
              that talk about why databases use B-trees, saved sometime in spring
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Looking for videos, pages and posts from March to May</p>
          <ol className="mt-5 flex flex-col gap-5">
            {demoResults.map((r) => (
              <li key={r.title} className="grid grid-cols-[4px_minmax(0,1fr)] gap-3 sm:gap-4">
                <span className="rounded-full" style={{ background: r.color }} aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-semibold" style={{ color: r.color }}>
                    {r.category}
                  </p>
                  <p className="mt-0.5 font-semibold leading-snug">
                    <Highlight text={r.title} terms={r.hits} />
                  </p>
                  <p className="mt-1 line-clamp-2 font-serif text-sm leading-relaxed text-muted-foreground">
                    <Highlight text={r.summary} terms={r.hits} />
                  </p>
                  <p className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <r.icon className="size-3.5" aria-hidden />
                      {r.source}
                    </span>
                    <span>{r.when}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </figure>
      </section>

      <Separator />
      <section className="grid gap-6 pt-8 pb-4 text-sm sm:grid-cols-3 sm:gap-8">
        <div>
          <h2 className="font-semibold">Save with one button</h2>
          <p className="mt-1 text-muted-foreground">
            The browser extension adds a button to your toolbar. Click it on any page, post or video.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Filed for you</h2>
          <p className="mt-1 text-muted-foreground">
            Each bookmark gets a summary, key points, tags and a category. Rename, merge or add
            categories whenever you like.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Search the way you remember</h2>
          <p className="mt-1 text-muted-foreground">
            Describe what it was about, where you saw it, or roughly when. Results match meaning, not
            just words.
          </p>
        </div>
      </section>
    </main>
  );
}
