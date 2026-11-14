"use client";

import Link from "next/link";
import { GitMergeIcon, PencilIcon, SearchIcon, SearchXIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { libraryHref } from "@/lib/search-params";
import {
  createCategoryAction,
  deleteCategoryAction,
  deleteUncategorizedAction,
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

export function CreateCategoryForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCategoryAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action}>
      <FieldGroup className="gap-4 sm:grid sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] sm:items-end sm:gap-3">
        <Field>
          <FieldLabel htmlFor="new-category-name">Name</FieldLabel>
          <Input id="new-category-name" name="name" required placeholder="e.g. Woodworking" className="bg-card" />
        </Field>
        <Field>
          <FieldLabel htmlFor="new-category-description">What belongs here</FieldLabel>
          <Input
            id="new-category-description"
            name="description"
            placeholder="Helps the AI file things"
            className="bg-card"
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Creating" : "Create category"}
        </Button>
        {state?.error ? (
          <FieldError className="text-xs sm:col-span-3">{state.error}</FieldError>
        ) : state?.message ? (
          <FieldDescription aria-live="polite" className="text-xs sm:col-span-3">
            {state.message}
          </FieldDescription>
        ) : null}
      </FieldGroup>
    </form>
  );
}

export function RefileButton() {
  const [state, action, pending] = useActionState<ActionState, FormData>(() => recategorizeAllAction(), null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
        {pending ? "Starting" : "Re-file library with AI"}
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {state?.message ?? "Sorts every bookmark again. Your own categories stay; AI-made ones are rebuilt."}
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

  const merge = () =>
    start(async () => {
      const target = others.find((o) => o.id === mergeInto)?.name;
      await mergeCategoryAction(category.id, mergeInto);
      toast.success(`Merged ${category.name} into ${target}.`);
    });

  const remove = () =>
    start(async () => {
      await deleteCategoryAction(category.id, true);
      toast.success(`Deleted ${category.name}. Its bookmarks are being filed again.`);
    });

  return (
    <li className="rounded-2xl border border-rule bg-card px-5 py-5 sm:px-6">
      <div className="min-w-0">
        {editing ? (
          <form action={action}>
            <input type="hidden" name="id" value={category.id} />
            <FieldGroup className="gap-3">
              <Field data-invalid={state?.error ? true : undefined}>
                <FieldLabel htmlFor={`name-${category.id}`}>Name</FieldLabel>
                <Input
                  id={`name-${category.id}`}
                  name="name"
                  defaultValue={category.name}
                  required
                  autoFocus
                  aria-invalid={state?.error ? true : undefined}
                  className="bg-card"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`description-${category.id}`}>Description</FieldLabel>
                <Textarea
                  id={`description-${category.id}`}
                  name="description"
                  defaultValue={category.description ?? ""}
                  rows={2}
                  placeholder="What belongs here"
                  className="bg-card"
                />
                {state?.error ? <FieldError>{state.error}</FieldError> : null}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {saving ? "Saving" : "Save changes"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </FieldGroup>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Link
                href={libraryHref("/library", { category: category.slug })}
                className="inline-flex items-center gap-2.5 rounded-sm text-lg font-semibold transition-colors duration-150 ease-out hover:text-action"
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: category.color }} />
                {category.name}
              </Link>
              <span className="text-sm text-ink-faint tabular-nums">
                {category.count} {category.count === 1 ? "bookmark" : "bookmarks"}
              </span>
              {category.source === "ai" ? (
                <Badge variant="outline" className="text-ink-soft">
                  <SparklesIcon />
                  Created by AI
                </Badge>
              ) : null}
            </div>
            <p className={`mt-1 max-w-[60ch] text-sm ${category.description ? "text-ink-soft" : "text-ink-faint italic"}`}>
              {category.description ?? "No description. Add one so the AI knows what goes here."}
            </p>
            <div className="-ml-2.5 mt-3 flex flex-wrap items-center gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon data-icon="inline-start" />
                Rename or describe
              </Button>
              {others.length ? (
                <div className="flex min-w-0 items-center gap-2">
                  <Select value={mergeInto} onValueChange={setMergeInto}>
                    <SelectTrigger size="sm" aria-label={`Merge ${category.name} into`} className="w-40 border-transparent bg-transparent shadow-none hover:bg-muted sm:w-44">
                      <SelectValue placeholder="Merge into…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {others.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {mergeInto ? (
                    <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={merge}>
                      <GitMergeIcon data-icon="inline-start" />
                      Merge
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2Icon data-icon="inline-start" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The category is removed and its {category.count === 1 ? "bookmark is" : "bookmarks are"} filed
                      again by AI. Bookmarks themselves are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={remove}>
                      Delete category
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** Not a real category: bookmarks with none, which can't be renamed or merged, only cleared out. */
function UncategorizedItem({ count, busy }: { count: number; busy: number }) {
  const [pending, start] = useTransition();

  const removeAll = () =>
    start(async () => {
      const { deleted } = await deleteUncategorizedAction();
      toast.success(`Deleted ${plural(deleted, "uncategorized bookmark")}.`);
    });

  return (
    <li className="rounded-2xl border border-dashed border-rule bg-card px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link
          href={libraryHref("/library", { category: "uncategorized" })}
          className="inline-flex items-center gap-2.5 rounded-sm text-lg font-semibold transition-colors duration-150 ease-out hover:text-action"
        >
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-rule" />
          Uncategorized
        </Link>
        <span className="text-sm text-ink-faint tabular-nums">{plural(count, "bookmark")}</span>
      </div>
      <p className="mt-1 max-w-[60ch] text-sm text-ink-soft">
        Bookmarks without a category: ones the AI hasn&apos;t filed yet or couldn&apos;t process.
      </p>
      <div className="-ml-2.5 mt-3 flex flex-wrap items-center gap-1.5">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              {pending ? <Spinner data-icon="inline-start" /> : <Trash2Icon data-icon="inline-start" />}
              {pending ? "Deleting" : "Delete all bookmarks"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {plural(count, "uncategorized bookmark")}?</AlertDialogTitle>
              <AlertDialogDescription>
                {count === 1 ? "This bookmark is" : `All ${count.toLocaleString()} bookmarks are`} removed from your library
                for good.
                {busy > 0
                  ? ` That includes ${plural(busy, "bookmark")} still being summarized, which would otherwise get a category soon.`
                  : ""}{" "}
                This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={removeAll}>
                Delete {plural(count, "bookmark")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

function matches(query: string, ...fields: (string | null)[]) {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
}

/** "Your categories": the list with a filter box, plus Uncategorized when it has bookmarks. */
export function CategoryList({
  categories,
  uncategorized,
}: {
  categories: Cat[];
  uncategorized: { count: number; busy: number };
}) {
  const [query, setQuery] = useState("");
  const shown = categories.filter((c) => matches(query, c.name, c.description));
  const showUncategorized = uncategorized.count > 0 && matches(query, "Uncategorized");
  const total = categories.length + (uncategorized.count > 0 ? 1 : 0);

  return (
    <>
      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="all-categories" className="scroll-mt-6 text-lg font-semibold tracking-tight">
            Your categories
          </h2>
          <p className="mt-1 text-sm text-ink-faint">Empty categories the AI created are removed on their own.</p>
        </div>
        <InputGroup className="bg-card sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Find a category"
            aria-label="Find a category"
            autoComplete="off"
            className="[&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Clear" onClick={() => setQuery("")}>
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>
      {query.trim() ? (
        <p aria-live="polite" className="mt-3 text-sm text-ink-faint">
          {shown.length + (showUncategorized ? 1 : 0)} of {total} shown
        </p>
      ) : null}
      {shown.length || showUncategorized ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {shown.map((c) => (
            <CategoryItem
              key={c.id}
              category={c}
              others={categories.filter((o) => o.id !== c.id).map((o) => ({ id: o.id, name: o.name }))}
            />
          ))}
          {showUncategorized ? <UncategorizedItem count={uncategorized.count} busy={uncategorized.busy} /> : null}
        </ul>
      ) : (
        <Empty className="mt-4 rounded-2xl border border-dashed border-rule bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>No category matches “{query.trim()}”</EmptyTitle>
            <EmptyDescription>Try part of the name, or create it above.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}