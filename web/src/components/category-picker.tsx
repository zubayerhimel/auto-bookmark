"use client";

import { SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { setBookmarkCategoryAction } from "@/lib/actions";

type Cat = { id: string; name: string };

const NEW = "__new";
const NONE = "__none";

export function CategoryPicker({
  bookmarkId,
  categories,
  currentId,
  locked,
}: {
  bookmarkId: string;
  categories: Cat[];
  currentId: string | null;
  locked: boolean;
}) {
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const apply = (choice: string) =>
    start(async () => {
      setError(null);
      try {
        await setBookmarkCategoryAction(bookmarkId, choice);
        setCreating(false);
        setName("");
      } catch (err) {
        setError((err as Error).message);
      }
    });

  return (
    <Field data-invalid={error ? true : undefined} className="gap-2">
      <FieldLabel htmlFor="category">Category</FieldLabel>
      <Select
        disabled={pending}
        value={creating ? NEW : (currentId ?? NONE)}
        onValueChange={(v) => {
          if (v === NEW) setCreating(true);
          else if (v !== NONE) {
            setCreating(false);
            apply(v);
          }
        }}
      >
        <SelectTrigger id="category" className="w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {!currentId ? <SelectItem value={NONE}>Uncategorized</SelectItem> : null}
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectItem value={NEW}>New category…</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {creating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) apply(`new:${name}`);
          }}
        >
          <InputGroup className="bg-card">
            <InputGroupInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              aria-label="New category name"
              enterKeyHint="done"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="default" disabled={pending || !name.trim()}>
                Create
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      ) : null}
      <FieldDescription className="flex items-center gap-1.5 text-xs">
        {pending ? <Spinner className="size-3" /> : null}
        {pending
          ? "Moving…"
          : locked
            ? "You placed this by hand, so re-filing leaves it here."
            : "Chosen by AI. Pick another to pin it there."}
      </FieldDescription>
      {locked ? (
        <Button type="button" variant="link" size="sm" disabled={pending} onClick={() => apply("auto")} className="self-start px-0">
          <SparklesIcon data-icon="inline-start" />
          Let AI choose again
        </Button>
      ) : null}
      {error ? <FieldError className="text-xs">{error}</FieldError> : null}
    </Field>
  );
}
