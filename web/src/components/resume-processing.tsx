"use client";

import { useEffect, useRef } from "react";
import { processWaitingAction } from "@/lib/actions";

/** Restarts processing when bookmarks are waiting and no background job is working on them. */
export function ResumeProcessing({ stalled }: { stalled: boolean }) {
  const lastRun = useRef(0);
  useEffect(() => {
    // One run lasts up to four minutes; don't stack more on top while it may still be going.
    if (!stalled || Date.now() - lastRun.current < 240_000) return;
    lastRun.current = Date.now();
    processWaitingAction().catch(() => {});
  }, [stalled]);
  return null;
}
