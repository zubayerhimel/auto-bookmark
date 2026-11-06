"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While bookmarks are still being processed, re-fetch the page so finished ones appear. */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
