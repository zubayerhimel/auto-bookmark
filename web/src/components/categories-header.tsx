import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateCategoryForm, RefileButton } from "@/components/category-forms";

/** The parts of the categories page that don't depend on data, shared with its loading state. */
export function CategoriesIntro() {
  return (
    <>
      <h1 className="text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-semibold tracking-tight">Categories</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        The AI files each new bookmark under the closest category and starts a new one when nothing fits. Add your own
        with a short description, then re-file the library to move matching bookmarks into them.
      </p>
    </>
  );
}

export function NewCategoryCard() {
  return (
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
  );
}
