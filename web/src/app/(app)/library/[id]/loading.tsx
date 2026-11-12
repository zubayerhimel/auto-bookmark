import { Skeleton } from "@/components/ui/skeleton";

/** Its own boundary, so opening a bookmark doesn't flash the library list skeleton. */
export default function BookmarkLoading() {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true">
      <Skeleton className="h-8 w-36" />
      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-2xl border border-rule bg-card px-5 pt-7 pb-8 sm:px-10 sm:pt-9 sm:pb-10">
          <div className="pl-9 sm:pl-11">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-9 w-4/5" />
            <Skeleton className="mt-3 h-4 w-60" />
            <Skeleton className="mt-5 h-9 w-36" />
            <div className="mt-8 flex flex-col gap-2">
              {[100, 95, 98, 70].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
