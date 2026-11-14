import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { createLoader, parseAsString, type SearchParams } from "nuqs/server";
import { AddLinkForm } from "@/components/add-link-form";
import { BookmarkRow, bookmarkListClass } from "@/components/bookmark-row";
import { ShareSave, UndoShare } from "@/components/share-save";
import { Button } from "@/components/ui/button";
import { findBookmarkByUrl } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";
import { sharedLink } from "@/lib/share";

export const metadata: Metadata = { title: "Save a link" };

const loadParams = createLoader({
  url: parseAsString,
  text: parseAsString,
  title: parseAsString,
  saved: parseAsString,
});

const heading = "text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-semibold tracking-tight";

/** Where the phone's share sheet (the web app's share target) and the iOS Shortcut land. */
export default async function SharePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await loadParams(searchParams);
  const link = sharedLink(params);

  if (!link) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className={heading}>No link to save</h1>
        <p className="mt-2 text-ink-soft">
          What was shared didn&apos;t include a web address. Paste the link here instead.
        </p>
        <div className="mt-6">
          <AddLinkForm />
        </div>
      </div>
    );
  }

  const existing = await findBookmarkByUrl(user.id, link.url);
  if (existing) {
    const { bookmark: b, category: c } = existing;
    const justSaved = params.saved === "1";
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className={heading}>{justSaved ? "Saved" : "Already in your library"}</h1>
        <p className="mt-2 text-ink-soft">
          {justSaved
            ? "It's being read, summarized and filed now."
            : "You saved this before, so nothing changed."}
        </p>
        <ul className={`mt-6 ${bookmarkListClass}`}>
          <BookmarkRow
            item={{
              ...b,
              categoryId: c?.id ?? null,
              categoryName: c?.name ?? null,
              categorySlug: c?.slug ?? null,
              categoryColor: c?.color ?? null,
            }}
          />
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/library/${b.id}`}>Open bookmark</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/library">Go to library</Link>
          </Button>
          {justSaved ? <UndoShare id={b.id} /> : null}
        </div>
      </div>
    );
  }

  // Save on arrival only when the visit came from the share sheet, a Shortcut or this app itself.
  // A link on some other site can bring you here, but it can't save into your library unasked.
  const site = (await headers()).get("sec-fetch-site");
  const auto = site === "none" || site === "same-origin";
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className={heading}>{auto ? "Saving…" : "Save this link?"}</h1>
      <div className="mt-6">
        <ShareSave url={link.url} note={link.note} auto={auto} />
      </div>
    </div>
  );
}
