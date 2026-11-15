"use client";

import Link from "next/link";
import { PencilIcon, SparklesIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { setBookmarkTagsAction } from "@/lib/actions";
import { isComposing } from "@/lib/keyboard";
import { libraryHref } from "@/lib/search-params";
import { cleanTags, MAX_TAG_LENGTH, MAX_TAGS } from "@/lib/tags";

/** The bookmark's tags, linking to the library; "Edit" turns them into an editable list. */
export function TagEditor({ bookmarkId, tags, locked }: { bookmarkId: string; tags: string[]; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();

  const add = (raw: string) => {
    const next = cleanTags([...draft, ...raw.split(",")]);
    setDraft(next);
    setInput("");
    return next;
  };

  const save = () => {
    const next = input.trim() ? add(input) : draft;
    start(async () => {
      try {
        await setBookmarkTagsAction(bookmarkId, next);
        setEditing(false);
      } catch {
        toast.error("Couldn't save the tags. Try again.");
      }
    });
  };

  const handBack = () =>
    start(async () => {
      try {
        await setBookmarkTagsAction(bookmarkId, null);
        toast.success("Tagging it again. This page updates when it's done.");
      } catch {
        toast.error("Couldn't hand the tags back to AI. Try again.");
      }
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Tags</h2>
        {editing ? null : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="-mr-2 text-ink-soft"
            onClick={() => {
              setDraft(tags);
              setEditing(true);
            }}
          >
            <PencilIcon data-icon="inline-start" />
            {tags.length ? "Edit" : "Add"}
          </Button>
        )}
      </div>

      {editing ? (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {draft.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {draft.map((t) => (
                <li key={t}>
                  <Badge variant="secondary" className="pr-0.5">
                    #{t}
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      onClick={() => setDraft(draft.filter((d) => d !== t))}
                      className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:bg-foreground/10 hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            autoFocus
            value={input}
            disabled={draft.length >= MAX_TAGS}
            maxLength={MAX_TAG_LENGTH * 4}
            onChange={(e) => {
              const v = e.target.value;
              if (v.includes(",")) add(v);
              else setInput(v);
            }}
            onKeyDown={(e) => {
              if (isComposing(e.nativeEvent)) return;
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault();
                add(input);
              } else if (e.key === "Backspace" && !input && draft.length) {
                setDraft(draft.slice(0, -1));
              } else if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            placeholder={draft.length >= MAX_TAGS ? `Up to ${MAX_TAGS} tags` : "Add a tag, press Enter"}
            aria-label="Add a tag"
            className="h-8 bg-card text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Save tags
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {tags.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li key={t}>
                  <Badge asChild variant="secondary">
                    <Link href={libraryHref("/library", { tag: t })}>#{t}</Link>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No tags yet.</p>
          )}
          {locked ? (
            <div className="mt-2 flex flex-col items-start gap-1">
              <p className="text-xs text-muted-foreground">You edited these, so summarizing again keeps them.</p>
              <Button type="button" variant="link" size="sm" disabled={pending} onClick={handBack} className="px-0">
                {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                Let AI tag it again
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
