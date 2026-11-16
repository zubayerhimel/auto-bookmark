"use client";

import { BookOpenCheckIcon, BookOpenIcon, FolderInputIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState, useTransition, type RefObject } from "react";
import { toast } from "sonner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { bulkBookmarksAction, type BulkOperation } from "@/lib/actions";
import { cn } from "@/lib/utils";

export type CategoryOption = { id: string; name: string; color: string };

const plural = (n: number) => (n === 1 ? "1 bookmark" : `${n.toLocaleString()} bookmarks`);

/**
 * Pinned to the bottom of the screen while selecting; runs one change on all selected bookmarks.
 * Stays mounted so it can slide back down when selecting ends.
 */
export function SelectionBar({
  open,
  anchor,
  ids,
  total,
  categories,
  onSelectAll,
  onDone,
  onApplied,
}: {
  open: boolean;
  /** The list the bar lines up with. */
  anchor: RefObject<HTMLElement | null>;
  ids: string[];
  /** How many cards are loaded, for "Select all". */
  total: number;
  categories: CategoryOption[];
  onSelectAll: () => void;
  onDone: () => void;
  /** Lets the list update cards it loaded itself, which the server refresh doesn't reach. */
  onApplied: (ids: string[], op: BulkOperation) => void;
}) {
  const [pending, start] = useTransition();
  const [running, setRunning] = useState<BulkOperation["kind"] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const count = ids.length;

  const run = (op: BulkOperation, done: (n: number) => string) => {
    setRunning(op.kind);
    start(async () => {
      try {
        const { count: n } = await bulkBookmarksAction(ids, op);
        onApplied(ids, op);
        toast.success(done(n));
        onDone();
      } catch (err) {
        toast.error((err as Error).message || "That didn't work. Try again.");
      } finally {
        setRunning(null);
      }
    });
  };
  const icon = (kind: BulkOperation["kind"], Icon: typeof BookOpenIcon) =>
    pending && running === kind ? <Spinner data-icon="inline-start" /> : <Icon data-icon="inline-start" />;

  // Fixed to the viewport so it's always at the bottom, but lined up with the list rather than the window.
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    const list = anchor.current;
    if (!el || !list) return;
    const place = () => {
      const r = list.getBoundingClientRect();
      el.style.left = `${r.left}px`;
      el.style.width = `${r.width}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    // The list keeps its width but shifts when the sidebar opens or closes.
    const inset = list.closest("[data-slot=sidebar-inset]");
    if (inset) observer.observe(inset);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [anchor]);

  const action = "@max-2xl/bar:size-9 @max-2xl/bar:px-0";
  const label = "hidden @2xl/bar:inline";

  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label="Selected bookmarks"
      inert={!open}
      className={cn(
        // Only translate and opacity move; visibility follows so the bar leaves the tab order once it's gone.
        "@container/bar fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 transition-[translate,opacity,visibility] ease-out motion-reduce:transition-[opacity,visibility] sm:bottom-5",
        open
          ? "duration-250"
          : "invisible translate-y-[calc(100%+1.5rem)] opacity-0 duration-150 motion-reduce:translate-y-0",
      )}
    >
      <div className="flex items-center gap-1 rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
        <Button type="button" variant="ghost" size="icon" aria-label="Stop selecting" onClick={onDone} disabled={pending}>
          <XIcon />
        </Button>
        <div className="flex min-w-0 flex-col items-start pr-2" aria-live="polite">
          <p className="truncate text-sm leading-5 font-medium tabular-nums">
            {count ? `${count.toLocaleString()} selected` : "None selected"}
          </p>
          {count < total ? (
            <Button
              type="button"
              variant="link"
              onClick={onSelectAll}
              className="h-auto p-0 text-xs leading-4 font-normal text-muted-foreground hover:text-foreground"
            >
              Select all {total.toLocaleString()}
            </Button>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Mark read"
            className={action}
            disabled={!count || pending}
            onClick={() => run({ kind: "read" }, (n) => `Marked ${plural(n)} as read.`)}
          >
            {icon("read", BookOpenCheckIcon)}
            <span className={label}>Mark read</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Mark unread"
            className={action}
            disabled={!count || pending}
            onClick={() => run({ kind: "unread" }, (n) => `Put ${plural(n)} on your To read list.`)}
          >
            {icon("unread", BookOpenIcon)}
            <span className={label}>Mark unread</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Favorite"
            className={action}
            disabled={!count || pending}
            onClick={() => run({ kind: "favorite" }, (n) => `Added ${plural(n)} to favorites.`)}
          >
            {icon("favorite", StarIcon)}
            <span className={label}>Favorite</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Move to category"
                className={action}
                disabled={!count || pending || !categories.length}
              >
                {icon("move", FolderInputIcon)}
                <span className={label}>Move to…</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={10} className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuLabel>Move to category</DropdownMenuLabel>
              <DropdownMenuGroup>
                {categories.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => run({ kind: "move", categoryId: c.id }, (n) => `Moved ${plural(n)} to ${c.name}.`)}
                  >
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="truncate">{c.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="mx-1 data-vertical:h-5 data-vertical:self-center" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Delete"
            disabled={!count || pending}
            onClick={() => setConfirming(true)}
            className={cn(action, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
          >
            {icon("delete", Trash2Icon)}
            <span className={label}>Delete</span>
          </Button>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {plural(count)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their summaries and notes go with them. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => run({ kind: "delete" }, (n) => `Deleted ${plural(n)}.`)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
