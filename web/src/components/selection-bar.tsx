"use client";

import { BookOpenCheckIcon, BookOpenIcon, FolderInputIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { bulkBookmarksAction, type BulkOperation } from "@/lib/actions";

export type CategoryOption = { id: string; name: string; color: string };

const plural = (n: number) => (n === 1 ? "1 bookmark" : `${n.toLocaleString()} bookmarks`);

/** Floats at the bottom of the list while bookmarks are selected; runs one change on all of them. */
export function SelectionBar({
  ids,
  total,
  categories,
  onSelectAll,
  onDone,
  onApplied,
}: {
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

  return (
    <div
      role="toolbar"
      aria-label="Selected bookmarks"
      className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-1 rounded-2xl border border-rule bg-card/95 p-1.5 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
    >
      <p className="px-2.5 text-sm font-medium tabular-nums" aria-live="polite">
        {count ? `${count.toLocaleString()} selected` : "Select bookmarks"}
      </p>
      {count < total ? (
        <Button type="button" variant="ghost" size="sm" onClick={onSelectAll} className="text-ink-soft">
          Select all {total.toLocaleString()}
        </Button>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!count || pending}
          onClick={() => run({ kind: "read" }, (n) => `Marked ${plural(n)} as read.`)}
        >
          {icon("read", BookOpenIcon)}
          Mark read
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!count || pending}
          onClick={() => run({ kind: "unread" }, (n) => `Put ${plural(n)} on your To read list.`)}
        >
          {icon("unread", BookOpenCheckIcon)}
          Mark unread
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" disabled={!count || pending || !categories.length}>
              {icon("move", FolderInputIcon)}
              Move to…
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuLabel>Move to category</DropdownMenuLabel>
            {categories.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onSelect={() => run({ kind: "move", categoryId: c.id }, (n) => `Moved ${plural(n)} to ${c.name}.`)}
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="truncate">{c.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!count || pending}
          onClick={() => setConfirming(true)}
          className="text-destructive hover:text-destructive"
        >
          {icon("delete", Trash2Icon)}
          Delete
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Stop selecting" onClick={onDone} disabled={pending}>
          <XIcon />
        </Button>
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
