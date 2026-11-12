import { bookmarkListClass } from "@/components/bookmark-row";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown the moment a library link is clicked, until the bookmarks arrive. */
export default function LibraryLoading() {
  return (
    <div className="mx-auto max-w-4xl" aria-busy="true">
      <Skeleton className="h-12 w-full rounded-2xl sm:h-14" />
      <div className="mt-10 flex flex-col gap-5 sm:mt-12 md:flex-row md:items-end md:justify-between">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-full md:max-w-sm" />
      </div>
      <div className="mt-4 flex h-10 items-center gap-6 shadow-[inset_0_-1px_0_var(--rule)]">
        {[20, 12, 18, 14].map((w, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${w * 0.25}rem` }} />
        ))}
      </div>
      <ul className={`mt-6 ${bookmarkListClass}`}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex gap-5 rounded-2xl border border-rule bg-card py-4 pr-4 pl-10 sm:pl-12">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-5 w-3/4" />
              <Skeleton className="mt-2.5 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-40" />
            </div>
            <Skeleton className="hidden aspect-[16/10] w-32 shrink-0 self-start sm:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}
