"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createCategoryAction,
  deleteCategoryAction,
  mergeCategoryAction,
  recategorizeAllAction,
  updateCategoryAction,
  type ActionState,
} from "@/lib/actions";

type Cat = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  source: "ai" | "user";
  count: number;
};

const field =
  "w-full rounded-md border border-rule bg-white px-3 py-2 text-sm placeholder:text-ink-faint focus:border-action focus:outline-none";

export function CreateCategoryForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCategoryAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
      <input name="name" required placeholder="Name, e.g. Woodworking" aria-label="Category name" className={field} />
      <input
        name="description"
        placeholder="What belongs here (helps the AI file things)"
        aria-label="Category description"
        className={field}
      />
      <button type="submit" disabled={pending} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-action disabled:opacity-60">
        {pending ? "Creating…" : "Create category"}
      </button>
      <p aria-live="polite" className={`text-xs sm:col-span-3 ${state?.error ? "text-danger" : "text-ink-faint"}`}>
        {state?.error ?? state?.message ?? ""}
      </p>
    </form>
  );
}

export function RefileButton() {
  const [state, action, pending] = useActionState<ActionState, FormData>(() => recategorizeAllAction(), null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-white disabled:opacity-60"
      >
        <Sparkles className="size-4" aria-hidden />
        {pending ? "Starting…" : "Re-file library with AI"}
      </button>
      <p aria-live="polite" className="text-xs text-ink-faint">
        {state?.message ?? "Sorts every bookmark again using your current categories."}
      </p>
    </form>
  );
}

export function CategoryItem({ category, others }: { category: Cat; others: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [state, action, saving] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await updateCategoryAction(prev, formData);
    if (result?.ok) setEditing(false);
    return result;
  }, null);
  const [pending, start] = useTransition();
  const [mergeInto, setMergeInto] = useState("");

  return (
    <li className="grid grid-cols-[5px_1fr] gap-4 py-5">
      <span aria-hidden className="rounded-full" style={{ background: category.color }} />
      <div className="min-w-0">
        {editing ? (
          <form action={action} className="grid gap-2">
            <input type="hidden" name="id" value={category.id} />
            <input name="name" defaultValue={category.name} required aria-label="Name" className={field} />
            <textarea
              name="description"
              defaultValue={category.description ?? ""}
              rows={2}
              aria-label="Description"
              placeholder="What belongs here"
              className={field}
            />
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-white hover:bg-action">
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-ink-soft hover:text-ink">
                Cancel
              </button>
            </div>
            {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <Link href={`/library?category=${category.slug}`} className="text-lg font-semibold hover:text-action">
                {category.name}
              </Link>
              <span className="text-sm text-ink-faint">
                {category.count} {category.count === 1 ? "bookmark" : "bookmarks"}
              </span>
              <span className="text-xs text-ink-faint">{category.source === "ai" ? "Created by AI" : "Created by you"}</span>
            </div>
            <p className="mt-0.5 max-w-[60ch] text-sm text-ink-soft">
              {category.description ?? "No description. Add one so the AI knows what goes here."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <button type="button" onClick={() => setEditing(true)} className="font-medium text-action hover:underline">
                Rename or describe
              </button>
              {others.length ? (
                <span className="inline-flex items-center gap-2">
                  <label htmlFor={`merge-${category.id}`} className="text-ink-soft">
                    Merge into
                  </label>
                  <select
                    id={`merge-${category.id}`}
                    value={mergeInto}
                    onChange={(e) => setMergeInto(e.target.value)}
                    className="rounded-md border border-rule bg-white px-2 py-1 text-sm"
                  >
                    <option value="">Choose…</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!mergeInto || pending}
                    onClick={() => start(() => mergeCategoryAction(category.id, mergeInto))}
                    className="font-medium text-action hover:underline disabled:text-ink-faint disabled:no-underline"
                  >
                    Merge
                  </button>
                </span>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Delete ${category.name}? Its bookmarks will be filed again by AI.`)) {
                    start(() => deleteCategoryAction(category.id, true));
                  }
                }}
                className="text-danger hover:underline"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}
