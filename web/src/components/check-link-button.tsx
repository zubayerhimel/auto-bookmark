"use client";

import { useState, useTransition } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { checkLinkAction, type ActionState } from "@/lib/actions";

/** Re-checks whether a bookmark's page exists; the page refreshes with the result. */
export function CheckLinkButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState>(null);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            setResult(await checkLinkAction(id));
          })
        }
      >
        {pending ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
        {pending ? "Checking" : "Check again"}
      </Button>
      {result ? (
        <p role="status" className={result.error ? "text-sm text-danger" : "text-sm text-muted-foreground"}>
          {result.error ?? result.message}
        </p>
      ) : null}
    </div>
  );
}
