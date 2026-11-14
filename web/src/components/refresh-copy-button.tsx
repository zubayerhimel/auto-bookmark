"use client";

import { useState, useTransition } from "react";
import { CircleAlertIcon, RefreshCwIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { refreshSavedCopyAction } from "@/lib/actions";

/** Fetches the page again to rebuild the reader's saved copy. */
export function RefreshCopyButton({ id, variant = "outline" }: { id: string; variant?: "outline" | "ghost" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await refreshSavedCopyAction(id);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
        {pending ? "Fetching the page" : "Refresh from the page"}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
