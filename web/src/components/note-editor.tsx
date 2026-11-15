"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { setBookmarkNoteAction } from "@/lib/actions";

/** The user's note on a bookmark (or the text they highlighted when saving it), editable in place. */
export function NoteEditor({ bookmarkId, note }: { bookmarkId: string; note: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      try {
        await setBookmarkNoteAction(bookmarkId, draft);
        setEditing(false);
      } catch {
        toast.error("Couldn't save the note. Try again.");
      }
    });

  if (editing) {
    return (
      <section className="mt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex max-w-[65ch] flex-col gap-2"
        >
          <label htmlFor="note" className="text-sm font-semibold text-muted-foreground">
            Your note
          </label>
          <Textarea
            id="note"
            autoFocus
            value={draft}
            maxLength={5000}
            rows={4}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            placeholder="Why you saved it, what to remember, what to do next…"
            className="bg-card leading-[1.65]"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Save note
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </section>
    );
  }

  const open = () => {
    setDraft(note ?? "");
    setEditing(true);
  };

  if (!note) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={open} className="mt-8 -ml-2.5 text-ink-soft">
        <PlusIcon data-icon="inline-start" />
        Add a note
      </Button>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex max-w-[65ch] items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Your note</h2>
        <Button type="button" variant="ghost" size="xs" onClick={open} className="-mr-2 text-ink-soft">
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
      </div>
      <p className="mt-2.5 max-w-[65ch] leading-[1.65] break-words whitespace-pre-line">
        <mark>{note}</mark>
      </p>
    </section>
  );
}
