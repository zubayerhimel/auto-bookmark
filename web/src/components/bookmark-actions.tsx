"use client";

import { BookOpenCheckIcon, BookOpenIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteBookmarkAction, reprocessBookmarkAction, setBookmarkReadAction } from "@/lib/actions";

/**
 * Opening a finished bookmark counts as reading it, so it comes off the To read list as soon as
 * this mounts. Runs in the browser rather than during render so link prefetches don't mark it.
 */
function useReadState(id: string, initiallyRead: boolean, ready: boolean) {
  const [override, setOverride] = useState<boolean | null>(null);
  const marked = useRef(false);
  useEffect(() => {
    if (initiallyRead || !ready || marked.current) return;
    marked.current = true;
    void setBookmarkReadAction(id, true);
  }, [id, initiallyRead, ready]);
  const read = override ?? (initiallyRead || ready);
  return [read, setOverride] as const;
}

export function BookmarkActions({ id, read: initiallyRead, ready }: { id: string; read: boolean; ready: boolean }) {
  const [pending, start] = useTransition();
  const [read, setRead] = useReadState(id, initiallyRead, ready);
  return (
    <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          const next = !read;
          setRead(next);
          start(async () => {
            await setBookmarkReadAction(id, next);
            toast.success(next ? "Marked as read." : "Back on your To read list.");
          });
        }}
      >
        {read ? <BookOpenIcon data-icon="inline-start" /> : <BookOpenCheckIcon data-icon="inline-start" />}
        {read ? "Mark as unread" : "Mark as read"}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await reprocessBookmarkAction(id);
            toast.success("Summarizing again. This page updates when it's done.");
          })
        }
      >
        {pending ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
        Summarize again
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" disabled={pending}>
            <Trash2Icon data-icon="inline-start" />
            Delete bookmark
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bookmark?</AlertDialogTitle>
            <AlertDialogDescription>Its summary and notes go with it. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => start(() => deleteBookmarkAction(id))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
