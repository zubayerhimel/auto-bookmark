"use client";

import { LinkIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { addBookmarkAction, type ActionState } from "@/lib/actions";

export function AddLinkForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addBookmarkAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <Field data-invalid={state?.error ? true : undefined} className="gap-1.5">
        <FieldLabel htmlFor="add-url" className="sr-only">
          Link to save
        </FieldLabel>
        <InputGroup className="h-10 bg-card">
          <InputGroupAddon>
            <LinkIcon />
          </InputGroupAddon>
          <InputGroupInput
            id="add-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            enterKeyHint="go"
            placeholder="Paste a link to save it"
            aria-invalid={state?.error ? true : undefined}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" variant="default" size="sm" disabled={pending} className="h-8 px-3">
              {pending ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
              {pending ? "Saving" : "Save"}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {state?.error ? (
          <FieldError className="px-1 text-xs">{state.error}</FieldError>
        ) : (
          <FieldDescription aria-live="polite" className="min-h-4 px-1 text-xs">
            {state?.message ?? ""}
          </FieldDescription>
        )}
      </Field>
    </form>
  );
}
