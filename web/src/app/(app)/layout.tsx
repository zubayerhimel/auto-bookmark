import Link from "next/link";
import { Suspense } from "react";
import { Puzzle, Tags } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserButton } from "@clerk/nextjs";
import { libraryStats, listCategoriesWithCounts } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [categories, stats] = await Promise.all([
    listCategoriesWithCounts(user.id),
    libraryStats(user.id),
  ]);

  return (
    <div className="mx-auto grid min-h-dvh max-w-[90rem] lg:grid-cols-[17rem_1fr]">
      <aside className="flex flex-col gap-6 px-4 pt-5 pb-3 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:py-7 lg:pr-3 lg:pl-6">
        <Link href="/library" className="px-2.5 text-lg font-bold tracking-tight">
          Auto Bookmark
        </Link>
        <nav aria-label="Categories" className="min-w-0">
          <Suspense>
            <SidebarNav categories={categories} total={stats.total} uncategorized={stats.uncategorized} />
          </Suspense>
        </nav>
        <div className="mt-auto hidden flex-col gap-1 border-t border-rule pt-4 text-sm lg:flex">
          <Link href="/categories" className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-ink-soft hover:bg-white/60 hover:text-ink">
            <Tags className="size-4" aria-hidden /> Manage categories
          </Link>
          <Link href="/extension" className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-ink-soft hover:bg-white/60 hover:text-ink">
            <Puzzle className="size-4" aria-hidden /> Browser extension
          </Link>
          <div className="mt-3 px-2.5">
            <UserButton showName />
          </div>
        </div>
      </aside>
      <main className="min-w-0 bg-sheet px-4 py-6 sm:px-8 lg:min-h-dvh lg:rounded-l-3xl lg:px-12 lg:py-10 lg:shadow-[-1px_0_0_var(--rule)]">
        {children}
        <nav className="mt-12 flex gap-5 border-t border-rule pt-4 text-sm text-ink-soft lg:hidden">
          <Link href="/categories">Manage categories</Link>
          <Link href="/extension">Browser extension</Link>
          <span className="ml-auto">
            <UserButton />
          </span>
        </nav>
      </main>
    </div>
  );
}
