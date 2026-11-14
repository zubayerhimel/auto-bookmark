"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BookmarkPlusIcon, CircleAlertIcon, Undo2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteBookmarkAction, shareBookmarkAction } from "@/lib/actions";

/**
 * Saves the shared link. `auto` saves straight away (the share came from the phone's share sheet);
 * otherwise, as when another site sent the visitor here, it waits for a tap.
 */
export function ShareSave({ url, note, auto }: { url: string; note: string | null; auto: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const save = () =>
    startTransition(async () => {
      try {
        await shareBookmarkAction(url, note);
        router.replace(`/share?${new URLSearchParams({ url, saved: "1" })}`);
      } catch {
        setError("That link couldn't be saved. Check it's a full web address and try again.");
      }
    });

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    save();
    // Runs once on arrival; `save` is stable for that purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-rule bg-card px-5 py-4">
        <p className="text-sm text-ink-faint">Link</p>
        <p className="mt-0.5 font-medium break-all">{url}</p>
        {note ? <p className="mt-2 text-sm text-ink-soft">“{note}”</p> : null}
      </div>
      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button onClick={save} disabled={pending} size="lg">
          {pending ? <Spinner data-icon="inline-start" /> : <BookmarkPlusIcon data-icon="inline-start" />}
          {pending ? "Saving" : "Save to library"}
        </Button>
      </div>
    </div>
  );
}

/** Takes back a save made by mistake. */
export function UndoShare({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => deleteBookmarkAction(id))}>
      {pending ? <Spinner data-icon="inline-start" /> : <Undo2Icon data-icon="inline-start" />}
      Undo
    </Button>
  );
}
