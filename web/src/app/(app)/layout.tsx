import Link from "next/link";
import { cookies } from "next/headers";
import { UserButton } from "@clerk/nextjs";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { libraryStats, listCategoriesWithCounts } from "@/lib/bookmarks";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [categories, stats, cookieStore] = await Promise.all([
    listCategoriesWithCounts(user.id),
    libraryStats(user.id),
    cookies(),
  ]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar categories={categories} total={stats.total} uncategorized={stats.uncategorized} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:static md:h-12 md:rounded-t-xl md:border-none md:bg-transparent md:backdrop-blur-none">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4 md:hidden" />
          <Link href="/library" className="font-bold tracking-tight md:hidden">
            Auto Bookmark
          </Link>
          <div className="ml-auto flex items-center md:hidden">
            <UserButton />
          </div>
        </header>
        <div className="flex-1 px-4 pt-4 pb-10 sm:px-8 md:pt-2 lg:px-12">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
