"use client";

import { useSyncExternalStore } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { isApplePlatform } from "@/lib/keyboard";

const noopSubscribe = () => () => {};

/** True on Apple devices, false elsewhere, null while rendering on the server. */
export function useIsApple() {
  return useSyncExternalStore(noopSubscribe, isApplePlatform, () => null);
}

/** Modifier names: `mod` is ⌘ on Apple devices and Ctrl elsewhere. */
const MODIFIERS: Record<string, { other: string; apple: string; name: string }> = {
  mod: { other: "Ctrl", apple: "⌘", name: "Command" },
  ctrl: { other: "Ctrl", apple: "⌃", name: "Control" },
  alt: { other: "Alt", apple: "⌥", name: "Option" },
  shift: { other: "Shift", apple: "⇧", name: "Shift" },
};

/**
 * Keys to press, labelled for the visitor's platform: `["mod", "K"]` reads "⌘ K" on a Mac and
 * "Ctrl K" on Windows. `apple` overrides the keys where Apple devices use a different shortcut.
 * Shows the non-Apple keys until the platform is known, or nothing with `hideUntilKnown`.
 */
export function Shortcut({
  keys,
  apple: appleKeys,
  hideUntilKnown = false,
  className,
  keyClassName,
}: {
  keys: string[];
  apple?: string[];
  hideUntilKnown?: boolean;
  className?: string;
  keyClassName?: string;
}) {
  const apple = useIsApple();
  if (apple === null && hideUntilKnown) return null;
  const list = apple && appleKeys ? appleKeys : keys;
  return (
    <KbdGroup className={className}>
      {list.map((k) => {
        const mod = MODIFIERS[k];
        if (!mod) return <Kbd key={k} className={keyClassName}>{k}</Kbd>;
        return apple ? (
          <Kbd key={k} title={mod.name} aria-label={mod.name} className={keyClassName}>
            {mod.apple}
          </Kbd>
        ) : (
          <Kbd key={k} className={keyClassName}>
            {mod.other}
          </Kbd>
        );
      })}
    </KbdGroup>
  );
}
