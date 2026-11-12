import type { Metadata } from "next";
import { TagsIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CategoriesIntro, NewCategoryCard } from "@/components/categories-header";
import { CategoryItem } from "@/components/category-forms";
import { CategoryShelf } from "@/components/category-shelf";
import { listCategoriesWithCounts } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await listCategoriesWithCounts(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <CategoriesIntro />

      {categories.length ? (
        <div className="mt-10">
          <CategoryShelf categories={categories} moreHref="#all-categories" />
        </div>
      ) : null}

      <NewCategoryCard />

      {categories.length === 0 ? (
        <Empty className="mt-6 rounded-2xl border border-dashed border-rule bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagsIcon />
            </EmptyMedia>
            <EmptyTitle>No categories yet</EmptyTitle>
            <EmptyDescription>
              Save a bookmark and the AI will create the first one, or add your own above.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
        <h2 id="all-categories" className="mt-12 scroll-mt-6 text-lg font-semibold tracking-tight">Your categories</h2>
        <p className="mt-1 text-sm text-ink-faint">Empty categories the AI created are removed on their own.</p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {categories.map((c) => (
            <CategoryItem
              key={c.id}
              category={c}
              others={categories.filter((o) => o.id !== c.id).map((o) => ({ id: o.id, name: o.name }))}
            />
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
