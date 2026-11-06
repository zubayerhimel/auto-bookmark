"use client";

import { RefreshCw, Trash } from "lucide-react";
import { useTransition } from "react";
import { deleteBookmarkAction, reprocessBookmarkAction } from "@/lib/actions";

export function BookmarkActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => reprocessBookmarkAction(id))}
        className="inline-flex items-center gap-2 text-ink-soft hover:text-ink disabled:opacity-60"
      >
        <RefreshCw className="size-4" aria-hidden />
        Summarize again
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this bookmark? This can't be undone.")) start(() => deleteBookmarkAction(id));
        }}
        className="inline-flex items-center gap-2 text-danger hover:underline disabled:opacity-60"
      >
        <Trash className="size-4" aria-hidden />
        Delete bookmark
      </button>
    </div>
  );
}
