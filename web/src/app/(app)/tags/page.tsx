import type { Metadata } from "next";
import { HashIcon } from "lucide-react";
import { TagCloud } from "@/components/tag-cloud";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { listTags } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsPage() {
  const user = await requireUser();
  const tags = await listTags(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-semibold tracking-tight">Tags</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        The AI tags each bookmark with the specific topics, names and tools it mentions. Pick a tag to see everything
        that carries it, across categories. Edit a bookmark&apos;s tags on its page.
      </p>

      {tags.length ? (
        <TagCloud tags={tags} />
      ) : (
        <Empty className="mt-8 rounded-2xl border border-dashed border-rule bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HashIcon />
            </EmptyMedia>
            <EmptyTitle>No tags yet</EmptyTitle>
            <EmptyDescription>Tags appear once your bookmarks have been summarized.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
