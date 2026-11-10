"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BookmarkIcon, PuzzleIcon, TagsIcon } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

type Cat = { id: string; name: string; slug: string; color: string; count: number };
type Props = { categories: Cat[]; total: number; uncategorized: number };

function useCloseOnNavigate() {
  const { isMobile, setOpenMobile } = useSidebar();
  return () => {
    if (isMobile) setOpenMobile(false);
  };
}

function CategoryMenu({ categories, total, uncategorized }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const close = useCloseOnNavigate();
  const active = pathname === "/library" ? (params.get("category") ?? "all") : null;

  const items = [
    { key: "all", href: "/library", label: "All bookmarks", count: total, color: "var(--ink)" },
    ...categories.map((c) => ({
      key: c.slug,
      href: `/library?category=${c.slug}`,
      label: c.name,
      count: c.count,
      color: c.color,
    })),
    ...(uncategorized > 0
      ? [{ key: "uncategorized", href: "/library?category=uncategorized", label: "Uncategorized", count: uncategorized, color: "var(--rule)" }]
      : []),
  ];

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.key}>
          <SidebarMenuButton asChild isActive={active === item.key}>
            <Link href={item.href} onClick={close} aria-current={active === item.key ? "page" : undefined}>
              <span aria-hidden className="ribbon-mark h-4 w-2 shrink-0 [--notch:3px]" style={{ background: item.color }} />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function MenuFallback({ count }: { count: number }) {
  return (
    <SidebarMenu>
      {Array.from({ length: count }, (_, i) => (
        <SidebarMenuItem key={i}>
          <SidebarMenuSkeleton />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar(props: Props) {
  const pathname = usePathname();
  const close = useCloseOnNavigate();

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/library" onClick={close}>
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <BookmarkIcon />
                </span>
                <span className="text-base font-bold tracking-tight">Auto Bookmark</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          <SidebarGroupContent>
            <Suspense fallback={<MenuFallback count={props.categories.length + 1} />}>
              <CategoryMenu {...props} />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/categories"}>
              <Link href="/categories" onClick={close}>
                <TagsIcon />
                <span>Manage categories</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/extension"}>
              <Link href="/extension" onClick={close}>
                <PuzzleIcon />
                <span>Browser extension</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex min-h-10 items-center px-2 pt-1">
          <UserButton showName />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
