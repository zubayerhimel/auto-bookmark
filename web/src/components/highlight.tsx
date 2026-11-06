function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

/** Wraps occurrences of the search terms in <mark>. Matches word prefixes, so "tree" marks "trees". */
export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  const usable = (terms ?? []).filter((t) => t.length >= 3);
  if (!usable.length || !text) return <>{text}</>;
  const pattern = new RegExp(`(${usable.map(escapeRegExp).join("|")})`, "gi");
  const lower = new Set(usable.map((t) => t.toLowerCase()));
  return (
    <>
      {text.split(pattern).map((part, i) =>
        lower.has(part.toLowerCase()) ? <mark key={i}>{part}</mark> : part,
      )}
    </>
  );
}
