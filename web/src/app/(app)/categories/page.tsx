import { TagsIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CategoryItem, CreateCategoryForm, RefileButton } from "@/components/category-forms";
import { listCategoriesWithCounts } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await listCategoriesWithCounts(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[clamp(1.6rem,3.5vw,var(--text-3xl))] font-bold tracking-tight">Categories</h1>
      <p className="mt-2 max-w-[60ch] text-muted-foreground">
        The AI files each new bookmark under the closest category and creates a new one when nothing
        fits. Add your own categories with a short description, then re-file the library to move
        matching bookmarks into them. Empty categories the AI created are removed automatically.
      </p>

      <Card className="mt-8">
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
        <Empty className="mt-6">
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
        <ul className="mt-6 divide-y divide-border">
          {categories.map((c) => (
            <CategoryItem
              key={c.id}
              category={c}
              others={categories.filter((o) => o.id !== c.id).map((o) => ({ id: o.id, name: o.name }))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
