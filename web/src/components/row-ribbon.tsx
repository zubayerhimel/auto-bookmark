"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * The colored ribbon beside a bookmark. While the AI is reading it the ribbon
 * crawls; when filing finishes (busy -> done while on screen) the category
 * ribbon drops in, the same gesture as the landing-page shelf. Rows that were
 * already filed on load stay still.
 */
export function RowRibbon({ busy, color }: { busy: boolean; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const wasBusy = useRef(busy);

  useEffect(() => {
    const el = ref.current;
    if (wasBusy.current && !busy && el) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.animate(
        reduce
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ transform: "scaleY(0.2)", opacity: 0 }, { transform: "scaleY(1)", opacity: 1 }],
        { duration: reduce ? 200 : 450, easing: EASE_OUT },
      );
    }
    wasBusy.current = busy;
  }, [busy]);

  return (
    <span
      ref={ref}
      aria-hidden
      className={cn("origin-top rounded-full", busy && "ribbon-pending")}
      style={busy ? undefined : { background: color }}
    />
  );
}
