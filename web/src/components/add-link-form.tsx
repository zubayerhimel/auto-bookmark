"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { addBookmarkAction, type ActionState } from "@/lib/actions";

export function AddLinkForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addBookmarkAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor="add-url" className="sr-only">
          Link to save
        </label>
        <input
          id="add-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="Paste a link to save it"
          className="min-w-0 flex-1 rounded-full border border-rule bg-white px-4 py-2 text-sm placeholder:text-ink-faint focus:border-action focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-action disabled:opacity-60"
        >
          <Plus className="size-4" aria-hidden />
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p aria-live="polite" className={`min-h-5 px-4 text-xs ${state?.error ? "text-danger" : "text-ink-faint"}`}>
        {state?.error ?? state?.message ?? ""}
      </p>
    </form>
  );
}
