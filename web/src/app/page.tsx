import { redirect } from "next/navigation";
import { FileText, MessageSquareText, MonitorPlay, Search } from "lucide-react";
import { Highlight } from "@/components/highlight";
import { SignInButton } from "@/components/sign-in-button";
import { getUser } from "@/lib/session";

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
  if (await getUser()) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-8 sm:px-8">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">Auto Bookmark</span>
      </header>

      <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="max-w-xl">
          <h1 className="text-[clamp(2.4rem,6vw,var(--text-4xl))] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance">
            Save anything once. Find it by describing it.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
            One click in your browser saves the page, the post on X, or the YouTube video you&apos;re
            looking at. AI reads it, writes a short summary, and files it under a category that
            fits, adding new categories as your interests change.
          </p>
          <SignInButton className="mt-9" callbackURL={next} />
          {params.error === "signin" ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              Google sign-in didn&apos;t finish. Please try again.
            </p>
          ) : null}
        </div>

        <figure aria-label="Example search" className="rounded-2xl bg-sheet p-5 shadow-[0_1px_0_var(--rule),0_24px_48px_-28px_rgba(27,36,48,0.35)] sm:p-7">
          <div className="flex items-start gap-3 border-b-2 border-ink pb-4">
            <Search className="mt-1.5 size-5 shrink-0 text-ink-faint" aria-hidden />
            <p className="text-xl leading-snug font-medium tracking-tight sm:text-2xl">
              that talk about why databases use B-trees, saved sometime in spring
            </p>
          </div>
          <p className="mt-3 text-sm text-ink-faint">Looking for videos, pages and posts from March to May</p>
          <ol className="mt-5 space-y-5">
            {demoResults.map((r) => (
              <li key={r.title} className="grid grid-cols-[4px_1fr] gap-4">
                <span className="rounded-full" style={{ background: r.color }} aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-semibold" style={{ color: r.color }}>
                    {r.category}
                  </p>
                  <p className="mt-0.5 font-semibold leading-snug">
                    <Highlight text={r.title} terms={r.hits} />
                  </p>
                  <p className="mt-1 line-clamp-2 font-serif text-sm leading-relaxed text-ink-soft">
                    <Highlight text={r.summary} terms={r.hits} />
                  </p>
                  <p className="mt-1.5 flex items-center gap-3 text-xs text-ink-faint">
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

      <section className="grid gap-8 border-t border-rule pt-8 pb-4 text-sm sm:grid-cols-3">
        <div>
          <h2 className="font-semibold">Save with one button</h2>
          <p className="mt-1 text-ink-soft">
            The browser extension adds a button to your toolbar. Click it on any page, post or video.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Filed for you</h2>
          <p className="mt-1 text-ink-soft">
            Each bookmark gets a summary, key points, tags and a category. Rename, merge or add
            categories whenever you like.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Search the way you remember</h2>
          <p className="mt-1 text-ink-soft">
            Describe what it was about, where you saw it, or roughly when. Results match meaning, not
            just words.
          </p>
        </div>
      </section>
    </main>
  );
}
