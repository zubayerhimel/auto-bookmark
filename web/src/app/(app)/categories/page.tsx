import type { Metadata } from "next";
import { TagsIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CategoriesIntro, NewCategoryCard } from "@/components/categories-header";
import { CategoryList } from "@/components/category-forms";
import { CategoryShelf } from "@/components/category-shelf";
import { libraryStats, listCategoriesWithCounts } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requireUser();
  const [categories, stats] = await Promise.all([listCategoriesWithCounts(user.id), libraryStats(user.id)]);
  const uncategorized = { count: stats.uncategorized, busy: stats.uncategorizedBusy };

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
      ) : null}
      {categories.length || uncategorized.count ? (
        <CategoryList categories={categories} uncategorized={uncategorized} />
      ) : null}
    </div>
  );
}