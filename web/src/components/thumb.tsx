"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** A preview image from the saved page. Many sites block hotlinking, so a failed load just disappears. */
export function Thumb({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("rounded-lg bg-paper object-cover outline-1 -outline-offset-1 outline-ink/10", className)}
    />
  );
}
