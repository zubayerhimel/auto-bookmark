/**
 * What another app shared, as a link to save. Apps disagree on where the link goes: some use
 * `url`, many Android apps put it inside `text` ("Look at this https://…"), a few in `title`.
 */
export function sharedLink(params: { url?: string | null; text?: string | null; title?: string | null }) {
  const candidates = [params.url, params.text, params.title];
  let url: string | null = null;
  for (const value of candidates) {
    const match = value?.match(/https?:\/\/[^\s<>"'`]+/i)?.[0];
    if (match) {
      url = match.replace(/[.,;:!?\]}"'»”’]+$/, "");
      // Keep a closing paren that belongs to the URL, like Wikipedia's Foo_(bar).
      while (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
        url = url.slice(0, -1).replace(/[.,;:!?\]}"'»”’]+$/, "");
      }
      break;
    }
  }
  if (!url) return null;

  // Text shared alongside the link, like a highlighted passage, is kept as the bookmark's note.
  const rest = (params.text ?? "")
    .replace(url, "")
    .replace(/\(\s*(?:[a-z]+\s*:)?\s*\)|\[\s*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+[.,;!?]+$/, "")
    .replace(/[\s:\-–—|]+$/, "")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
  const title = params.title?.trim();
  const note = rest.length > 1 && rest !== title && !/^https?:\/\//i.test(rest) ? rest.slice(0, 2000) : null;
  return { url, note };
}
