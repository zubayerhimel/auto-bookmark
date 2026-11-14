export type ReaderBlock = { kind: "heading" | "paragraph"; text: string } | { kind: "list"; items: string[] };

/**
 * Turns a saved copy (plain text, a blank line between blocks, "• " before list items) into blocks
 * to render. Copies saved before blocks were kept may only have single line breaks; those split
 * the same way.
 */
export function readerBlocks(content: string): ReaderBlock[] {
  const lines = content
    .split(/\s*\n\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: ReaderBlock[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith("• ")) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list") last.items.push(line.slice(2));
      else blocks.push({ kind: "list", items: [line.slice(2)] });
      return;
    }
    // A short line without closing punctuation that introduces a real paragraph reads as a heading.
    const next = lines[i + 1];
    const heading =
      line.length <= 90 &&
      !/[.,;:!?)"'”’…]$/.test(line) &&
      next !== undefined &&
      !next.startsWith("• ") &&
      next.length >= 80;
    blocks.push({ kind: heading ? "heading" : "paragraph", text: line });
  });
  return blocks;
}

export function readingMinutes(content: string) {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

/** One long run of text: saved before paragraphs were kept, so refreshing it from the page helps. */
export function looksFlattened(content: string) {
  return content.length > 400 && !content.includes("\n");
}
