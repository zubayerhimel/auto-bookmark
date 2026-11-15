"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { deleteAllDataAction } from "@/lib/actions";

const WORD = "delete";

export function DeleteAllData({ total }: { total: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const confirmed = typed.trim().toLowerCase() === WORD;

  const submit = () =>
    start(async () => {
      const result = await deleteAllDataAction(typed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(result?.message ?? "Everything is deleted.");
      router.push("/library");
    });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) {
          setTyped("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive">
          <Trash2Icon data-icon="inline-start" />
          Delete all my data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmed && !pending) submit();
          }}
          className="contents"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete everything?</AlertDialogTitle>
            <AlertDialogDescription>
              {total === 1 ? "Your bookmark" : `All ${total.toLocaleString()} bookmarks`}, with their summaries, notes
              and tags, plus your categories, extension sign-ins and saved AI key, are removed for good. Your account stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={error ? true : undefined} className="gap-1.5">
            <FieldLabel htmlFor="delete-all-confirm" className="text-sm font-normal">
              Type <span className="font-mono font-semibold">{WORD}</span> to confirm
            </FieldLabel>
            <Input
              id="delete-all-confirm"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={typed}
              disabled={pending}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
            />
            {error ? <FieldError className="text-xs">{error}</FieldError> : null}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!confirmed || pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Delete everything
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
