export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

/** Tags as they're stored: lowercase, trimmed, no leading "#", unique, at most `MAX_TAGS`. */
export function cleanTags(tags: unknown[]) {
  const out = new Set<string>();
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const tag = t.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase().slice(0, MAX_TAG_LENGTH).trim();
    if (tag) out.add(tag);
  }
  return [...out].slice(0, MAX_TAGS);
}
