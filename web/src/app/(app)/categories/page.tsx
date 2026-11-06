import { CategoryItem, CreateCategoryForm, RefileButton } from "@/components/category-forms";
import { listCategoriesWithCounts } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await listCategoriesWithCounts(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[clamp(1.6rem,3.5vw,var(--text-3xl))] font-bold tracking-tight">Categories</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        The AI files each new bookmark under the closest category and creates a new one when nothing
        fits. Add your own categories with a short description, then re-file the library to move
        matching bookmarks into them. Empty categories the AI created are removed automatically.
      </p>

      <section className="mt-8 rounded-xl bg-paper/60 p-5">
        <h2 className="font-semibold">New category</h2>
        <div className="mt-3">
          <CreateCategoryForm />
        </div>
        <div className="mt-2 border-t border-rule pt-4">
          <RefileButton />
        </div>
      </section>

      {categories.length === 0 ? (
        <p className="py-12 text-ink-soft">
          No categories yet. Save a bookmark and the AI will create the first one, or add your own above.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-rule">
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
