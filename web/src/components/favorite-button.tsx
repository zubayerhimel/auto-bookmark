"use client";

import { StarIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { setBookmarkFavoriteAction } from "@/lib/actions";

/**
 * Stars a bookmark. `compact` is the small icon on library cards: always shown once starred,
 * otherwise only on hover or focus (and always on touch screens).
 */
export function FavoriteButton({
  id,
  favorite,
  compact = false,
  className,
  onChange,
}: {
  id: string;
  favorite: boolean;
  compact?: boolean;
  className?: string;
  /** Called once the change is saved. */
  onChange?: (favorite: boolean) => void;
}) {
  // Local rather than optimistic state: cards loaded by scrolling aren't redrawn by the server
  // refresh, so their `favorite` prop can stay stale. A changed prop still wins.
  const [state, setState] = useState({ on: favorite, from: favorite });
  if (state.from !== favorite) setState({ on: favorite, from: favorite });
  const on = state.on;
  const [, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setState((s) => ({ ...s, on: next }));
    start(async () => {
      try {
        await setBookmarkFavoriteAction(id, next);
        onChange?.(next);
      } catch {
        setState((s) => ({ ...s, on: !next }));
        toast.error(next ? "Couldn't add it to favorites. Try again." : "Couldn't remove it from favorites. Try again.");
      }
    });
  };

  const label = on ? "Remove from favorites" : "Add to favorites";
  const star = (
    <StarIcon
      data-icon={compact ? undefined : "inline-start"}
      className={cn("transition-[fill,color,scale] duration-150 ease-out", on && "fill-current text-amber-500")}
    />
  );

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        aria-pressed={on}
        title={label}
        onClick={toggle}
        data-on={on || undefined}
        className={cn(
          // z-1 lifts it above the title link's whole-card overlay, which comes later in the card.
          "relative z-1 text-ink-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:scale-90 data-on:opacity-100 pointer-coarse:opacity-100",
          className,
        )}
      >
        {star}
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" aria-pressed={on} onClick={toggle} className={className}>
      {star}
      {on ? "Favorited" : "Favorite"}
    </Button>
  );
}
