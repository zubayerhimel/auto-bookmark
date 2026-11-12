import { CategoriesIntro, NewCategoryCard } from "@/components/categories-header";
import { Skeleton } from "@/components/ui/skeleton";

const RIBBONS = [11, 9, 8, 7, 6, 5, 4];

/** Shows the page's static parts right away while the counts load. */
export default function CategoriesLoading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy="true">
      <CategoriesIntro />

      <div className="mt-10 border-t-2 border-ink">
        <div className="flex items-start gap-2.5">
          {RIBBONS.map((h, i) => (
            <Skeleton key={i} className="w-11 rounded-none rounded-b-sm" style={{ height: `${h}rem` }} />
          ))}
        </div>
      </div>

      <NewCategoryCard />

      <Skeleton className="mt-12 h-6 w-40" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <ul className="mt-4 flex flex-col gap-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <Skeleton className="h-20 rounded-2xl" />
          </li>
        ))}
      </ul>
    </div>
  );
}
