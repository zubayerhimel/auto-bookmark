"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A Link that prefetches the whole page, data included, once the user shows intent (hover, focus,
 * touch). Until then it prefetches only the loading shell like any Link, so long lists stay cheap.
 */
export function IntentLink({ onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? true : null}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
    />
  );
}
