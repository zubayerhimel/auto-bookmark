"use client";

import { useState, useTransition } from "react";
import { setBookmarkCategoryAction } from "@/lib/actions";

type Cat = { id: string; name: string };

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
    <div className="flex flex-col gap-2">
      <label htmlFor="category" className="text-sm font-semibold">
        Category
      </label>
      <select
        id="category"
        disabled={pending}
        value={creating ? "__new" : (currentId ?? "")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__new") setCreating(true);
          else if (v) {
            setCreating(false);
            apply(v);
          }
        }}
        className="rounded-md border border-rule bg-white px-3 py-2 text-sm disabled:opacity-60"
      >
        {!currentId ? <option value="">Uncategorized</option> : null}
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="__new">New category…</option>
      </select>
      {creating ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) apply(`new:${name}`);
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            aria-label="New category name"
            className="min-w-0 flex-1 rounded-md border border-rule bg-white px-3 py-1.5 text-sm"
          />
          <button type="submit" disabled={pending} className="rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-action">
            Create
          </button>
        </form>
      ) : null}
      <p className="text-xs text-ink-faint">
        {pending
          ? "Moving…"
          : locked
            ? "You placed this by hand, so re-filing leaves it here."
            : "Chosen by AI. Pick another to pin it there."}
      </p>
      {locked ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => apply("auto")}
          className="self-start text-xs font-semibold text-action underline underline-offset-4"
        >
          Let AI choose again
        </button>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
