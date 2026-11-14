import type { Metadata } from "next";
import { ImportForm } from "@/components/import-form";
import { Spinner } from "@/components/ui/spinner";
import { libraryStats } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Import bookmarks" };

// Processing an import runs in the background after the request; give it the full function time.
export const maxDuration = 300;

const kbd = "rounded border border-rule bg-paper px-1 py-px font-mono text-[0.75rem] text-ink";

const SOURCES = [
  {
    name: "Chrome, Edge, Brave or Arc",
    how: (
      <>
        Open the bookmark manager (<kbd className={kbd}>Ctrl</kbd> <kbd className={kbd}>Shift</kbd>{" "}
        <kbd className={kbd}>O</kbd>), open the ⋮ menu and choose Export bookmarks.
      </>
    ),
  },
  {
    name: "Firefox",
    how: <>Open the Library (Ctrl Shift O), then Import and Backup → Export Bookmarks to HTML.</>,
  },
  { name: "Safari", how: <>File → Export → Bookmarks.</> },
  {
    name: "Raindrop, Pocket, Instapaper",
    how: <>Use their HTML or CSV export. Tags and the unread list come along.</>,
  },
  { name: "Anything else", how: <>A .txt file with one link per line.</> },
];

export default async function ImportPage() {
  const user = await requireUser();
  const stats = await libraryStats(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-semibold tracking-tight">
        Import bookmarks
      </h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        Bring in the bookmarks you already have. Each one is read, summarized and filed like a new save, so years of
        links become searchable by what they&apos;re about. Your file is read in the browser; only the links are sent.
      </p>

      {stats.busy > 0 ? (
        <p
          role="status"
          className="mt-6 flex items-center gap-2 rounded-xl border border-rule bg-card px-4 py-3 text-sm text-ink-soft"
        >
          <Spinner />
          Summarizing and filing {stats.busy.toLocaleString()} {stats.busy === 1 ? "bookmark" : "bookmarks"}. They
          show up in your library as they finish.
        </p>
      ) : null}

      <div className="mt-8">
        <ImportForm />
      </div>

      <section aria-labelledby="export-how" className="mt-12">
        <h2 id="export-how" className="text-lg font-semibold tracking-tight">
          Getting an export file
        </h2>
        <dl className="mt-3 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
          {SOURCES.map((s) => (
            <div key={s.name} className="grid gap-1 px-5 py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
              <dt className="font-medium">{s.name}</dt>
              <dd className="text-sm leading-relaxed text-ink-soft">{s.how}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
