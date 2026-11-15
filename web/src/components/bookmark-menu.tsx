"use client";

import {
  BookOpenCheckIcon,
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FolderInputIcon,
  StarIcon,
  StarOffIcon,
  Trash2Icon,
} from "lucide-react";
import { createContext, use, useState, useTransition, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bulkBookmarksAction, type BulkOperation } from "@/lib/actions";
import type { CategoryOption } from "./selection-bar";

export type MenuBookmark = {
  id: string;
  url: string;
  title: string;
  read: boolean;
  favorite: boolean;
  categoryId: string | null;
};

export type BookmarkMenuProps = {
  categories: CategoryOption[];
  /** Lets the list update cards it loaded itself, which the server refresh doesn't reach. */
  onApplied: (ids: string[], op: BulkOperation) => void;
};

type MenuState = {
  item: MenuBookmark;
  categories: CategoryOption[];
  pending: boolean;
  run: (op: BulkOperation, done: string) => void;
  confirmDelete: () => void;
};

const MenuContext = createContext<MenuState | null>(null);

/** The pieces both menus are built from; the context and dropdown versions share one API. */
type Parts = {
  Group: ComponentType<{ children: ReactNode }>;
  Item: ComponentType<{
    children: ReactNode;
    onSelect?: (e: Event) => void;
    disabled?: boolean;
    variant?: "default" | "destructive";
    asChild?: boolean;
  }>;
  Separator: ComponentType;
  Sub: ComponentType<{ children: ReactNode }>;
  SubTrigger: ComponentType<{ children: ReactNode; disabled?: boolean }>;
  SubContent: ComponentType<{ children: ReactNode; className?: string }>;
};

const contextParts: Parts = {
  Group: ContextMenuGroup,
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

const dropdownParts: Parts = {
  Group: DropdownMenuGroup,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

function MenuItems({ parts: P }: { parts: Parts }) {
  const { item, categories, pending, run, confirmDelete } = use(MenuContext)!;
  return (
    <>
      <P.Group>
        <P.Item asChild>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
            Open original
          </a>
        </P.Item>
        <P.Item
          onSelect={() =>
            navigator.clipboard.writeText(item.url).then(
              () => toast.success("Link copied."),
              () => toast.error("Couldn't copy the link."),
            )
          }
        >
          <CopyIcon />
          Copy link
        </P.Item>
      </P.Group>
      <P.Separator />
      <P.Group>
        <P.Item
          disabled={pending}
          onSelect={() =>
            item.favorite
              ? run({ kind: "unfavorite" }, "Removed from favorites.")
              : run({ kind: "favorite" }, "Added to favorites.")
          }
        >
          {item.favorite ? <StarOffIcon /> : <StarIcon />}
          {item.favorite ? "Remove from favorites" : "Add to favorites"}
        </P.Item>
        <P.Item
          disabled={pending}
          onSelect={() =>
            item.read
              ? run({ kind: "unread" }, "Back on your To read list.")
              : run({ kind: "read" }, "Marked as read.")
          }
        >
          {item.read ? <BookOpenIcon /> : <BookOpenCheckIcon />}
          {item.read ? "Mark as unread" : "Mark as read"}
        </P.Item>
        <P.Sub>
          <P.SubTrigger disabled={pending || !categories.length}>
            <FolderInputIcon />
            Move to
          </P.SubTrigger>
          <P.SubContent className="max-h-72 w-52 overflow-y-auto">
            {categories.map((c) => {
              const current = c.id === item.categoryId;
              return (
                <P.Item
                  key={c.id}
                  disabled={pending || current}
                  onSelect={() => run({ kind: "move", categoryId: c.id }, `Moved to ${c.name}.`)}
                >
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {current ? <CheckIcon aria-label="Current category" /> : null}
                </P.Item>
              );
            })}
          </P.SubContent>
        </P.Sub>
      </P.Group>
      <P.Separator />
      <P.Group>
        <P.Item variant="destructive" disabled={pending} onSelect={confirmDelete}>
          <Trash2Icon />
          Delete
        </P.Item>
      </P.Group>
    </>
  );
}

/**
 * Wraps a library card so right-clicking (or long-pressing) it opens its actions.
 * `BookmarkMenuButton`, placed inside the card, opens the same menu.
 */
export function BookmarkMenu({
  item,
  categories,
  onApplied,
  disabled,
  children,
}: BookmarkMenuProps & { item: MenuBookmark; disabled?: boolean; children: ReactNode }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (op: BulkOperation, done: string) =>
    start(async () => {
      try {
        await bulkBookmarksAction([item.id], op);
        onApplied([item.id], op);
        toast.success(done);
      } catch (err) {
        toast.error((err as Error).message || "That didn't work. Try again.");
      }
    });

  return (
    <MenuContext value={{ item, categories, pending, run, confirmDelete: () => setConfirming(true) }}>
      <ContextMenu modal={false}>
        <ContextMenuTrigger asChild disabled={disabled}>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <MenuItems parts={contextParts} />
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bookmark?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{item.title}&rdquo; goes with its summary and notes. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => run({ kind: "delete" }, "Bookmark deleted.")}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MenuContext>
  );
}

/** The "⋯" button on a card: the card's menu for touch screens and keyboards. */
export function BookmarkMenuButton({ className }: { className?: string }) {
  const state = use(MenuContext);
  if (!state) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Actions for ${state.item.title}`}
          className={cn(
            "relative z-1 text-ink-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100",
            className,
          )}
        >
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <MenuItems parts={dropdownParts} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
