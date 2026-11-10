import { TagsIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CategoryItem, CreateCategoryForm, RefileButton } from "@/components/category-forms";
import { CategoryShelf } from "@/components/category-shelf";
import { listCategoriesWithCounts } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await listCategoriesWithCounts(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-bold tracking-tight">Categories</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        The AI files each new bookmark under the closest category and starts a new one when nothing fits. Add your own
        with a short description, then re-file the library to move matching bookmarks into them.
      </p>

      {categories.length ? (
        <div className="mt-10">
          <CategoryShelf categories={categories} moreHref="#all-categories" />
        </div>
      ) : null}

      <Card className="mt-10 rounded-2xl">
        <CardHeader>
          <CardTitle>New category</CardTitle>
          <CardDescription>Give it a short description so the AI knows what to file here.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCategoryForm />
        </CardContent>
        <CardFooter className="border-t">
          <RefileButton />
        </CardFooter>
      </Card>

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
        <h2 id="all-categories" className="mt-12 scroll-mt-6 text-lg font-bold tracking-tight">Your categories</h2>
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
