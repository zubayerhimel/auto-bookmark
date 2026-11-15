"use client";

import { ExternalLinkIcon, KeyRoundIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { removeAiSettingsAction, saveAiSettingsAction, type ActionState } from "@/lib/actions";
import { AI_PROVIDERS, PROVIDERS, type AiProvider } from "@/lib/ai-providers";

type Saved = { provider: AiProvider; keyHint: string; model: string | null } | null;

export function AiKeyForm({ saved }: { saved: Saved }) {
  const [provider, setProvider] = useState<AiProvider>(saved?.provider ?? "openai");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAiSettingsAction, null);
  const keyRef = useRef<HTMLInputElement>(null);
  const info = PROVIDERS[provider];
  // A blank key keeps the saved one, but only for the provider it belongs to.
  const keepsKey = saved?.provider === provider;

  useEffect(() => {
    if (state?.ok) {
      if (keyRef.current) keyRef.current.value = "";
      toast.success(state.message ?? "Saved.");
    }
  }, [state]);

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ai-provider">Provider</FieldLabel>
          <Select name="provider" value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
            <SelectTrigger id="ai-provider" className="w-full bg-card sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {AI_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PROVIDERS[p].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {info.embeddingModel ? null : (
            <FieldDescription>
              Claude has no embedding model, so search matches words only, not meaning. Choose OpenRouter to use Claude
              with meaning-based search.
            </FieldDescription>
          )}
        </Field>

        <Field data-invalid={state?.error ? true : undefined}>
          <FieldLabel htmlFor="ai-key">API key</FieldLabel>
          <Input
            ref={keyRef}
            id="ai-key"
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            required={!keepsKey}
            placeholder={keepsKey ? `Saved key ending in ${saved.keyHint}. Leave blank to keep it.` : info.keyPlaceholder}
            aria-invalid={state?.error ? true : undefined}
            className="bg-card font-mono"
          />
          <FieldDescription>
            <a href={info.keysUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
              Get a {info.name} key
              <ExternalLinkIcon className="size-3" aria-hidden />
            </a>
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="ai-model">Model (optional)</FieldLabel>
          <Input
            key={provider}
            id="ai-model"
            name="model"
            autoComplete="off"
            spellCheck={false}
            defaultValue={saved?.provider === provider ? (saved.model ?? "") : ""}
            placeholder={info.defaultModel}
            className="bg-card font-mono"
          />
          <FieldDescription>
            Leave blank for {info.defaultModel}, a fast, low-cost model that does this job well.
          </FieldDescription>
        </Field>

        {state?.error ? <FieldError>{state.error}</FieldError> : null}

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
            {pending ? "Checking the key" : "Save and test"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

export function RemoveAiKeyButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const remove = () =>
    start(async () => {
      const result = await removeAiSettingsAction();
      setOpen(false);
      toast.success(result?.message ?? "Key removed.");
    });
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Trash2Icon data-icon="inline-start" />
          Remove key
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove your AI key?</AlertDialogTitle>
          <AlertDialogDescription>
            New bookmarks are still saved, but they won&apos;t be summarized, tagged or filed until you add a key again.
            Your existing summaries stay.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={remove}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Remove key
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NoKeyNotice() {
  return (
    <Alert>
      <KeyRoundIcon />
      <AlertDescription>
        No key yet. Bookmarks are saved, but not summarized, tagged or filed until you add one.
      </AlertDescription>
    </Alert>
  );
}
