/**
 * Keyboard shortcut helpers shared across the app, so shortcuts behave the same on Windows,
 * Linux, macOS and iPadOS with a hardware keyboard.
 */

type KeyEventLike = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/** Apple keyboards use ⌘ where others use Ctrl. iPadOS in desktop mode reports itself as "MacIntel". */
export function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent);
}

/**
 * Whether the event is `key` (a letter or "/"). Falls back to the physical key when the layout
 * doesn't type a Latin character there (Bangla, Cyrillic…), without remapping Latin layouts like Dvorak.
 */
function isKey(e: KeyEventLike, key: string) {
  if (e.key.toLowerCase() === key) return true;
  if (/^[\x21-\x7e]$/.test(e.key)) return false;
  return e.code === (key === "/" ? "Slash" : `Key${key.toUpperCase()}`);
}

/**
 * ⌘+key on Apple devices, Ctrl+key elsewhere, with no other modifier. Only the platform's own
 * modifier counts: on a Mac, Ctrl+K and Ctrl+B are text-editing keys in fields, and AltGr
 * (Ctrl+Alt on Windows) types characters.
 */
export function isModShortcut(e: KeyEventLike, key: string) {
  const mod = isApplePlatform() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  return mod && !e.altKey && !e.shiftKey && isKey(e, key);
}

/** A bare "/" press, as typed on any layout (Shift or AltGr may be needed to reach it). */
export function isSlash(e: KeyEventLike) {
  if (e.metaKey || (e.ctrlKey && !e.altKey)) return false;
  return isKey(e, "/");
}

/** Typing into something, where single-key shortcuts must not fire. */
export function isEditableTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * The key belongs to an input method (Japanese, Chinese, Vietnamese…) still composing text.
 * Safari ends composition before the confirming Enter's keydown, which then only shows as keyCode 229.
 */
export function isComposing(e: KeyboardEvent) {
  return e.isComposing || e.keyCode === 229;
}
