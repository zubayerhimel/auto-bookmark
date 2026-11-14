/**
 * Reads bookmark exports in the browser, so a large file (Chrome's export embeds every favicon)
 * never has to be uploaded: only the links themselves are sent to the server.
 *
 * Understands the "Netscape bookmark file" every browser exports (Chrome, Edge, Firefox, Safari,
 * Brave, Arc) along with Raindrop and Pocket's HTML, CSV exports with a url column (Pocket,
 * Raindrop, Instapaper), and plain text with one link per line.
 */

/** New links one import adds at most; each is fetched, summarized and embedded, so this bounds the AI bill. */
export const IMPORT_CAP = 500;
/** Links per request, so each stays well under the server action body limit. */
export const IMPORT_CHUNK = 250;

export type ImportItem = {
  url: string;
  title: string | null;
  /** When it was originally saved, in ms since the epoch. */
  addedAt: number | null;
  /** Folder names and the export's own tags. */
  tags: string[];
  /** False only when the source says it's still unread (Pocket's list). */
  read: boolean;
};

export type ParsedImport = {
  format: "bookmarks" | "csv" | "text";
  items: ImportItem[];
  folders: number;
};

/** Folders every browser creates; they say nothing about the links inside. */
const ROOT_FOLDERS = new Set([
  "bookmarks",
  "bookmarks bar",
  "bookmarks toolbar",
  "bookmarks menu",
  "other bookmarks",
  "mobile bookmarks",
  "favorites",
  "favorites bar",
  "favourites",
  "favourites bar",
  "imported",
  "imported bookmarks",
  "unsorted",
  "unread",
  "read archive",
  "menu",
  "toolbar",
]);

const MAX_TAGS = 5;

function cleanTag(raw: string) {
  const tag = raw.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);
  return tag && !ROOT_FOLDERS.has(tag) ? tag : null;
}

function cleanTags(raw: (string | null | undefined)[]) {
  const tags = raw.map((t) => (t ? cleanTag(t) : null)).filter((t): t is string => !!t);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

function isWebLink(url: string) {
  return /^https?:\/\/[^\s]+$/i.test(url) && url.length <= 2048;
}

/** Seconds, milliseconds, microseconds (Firefox's JSON) or a date string, to ms. Null if implausible. */
export function parseWhen(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim();
  let ms: number;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    ms = n > 1e14 ? n / 1000 : n > 1e11 ? n : n * 1000;
  } else {
    ms = Date.parse(value);
  }
  // Before the web went mainstream, or in the future: a bad value, not a real date.
  if (!Number.isFinite(ms) || ms < Date.UTC(1995, 0, 1) || ms > Date.now() + 86_400_000) return null;
  return Math.round(ms);
}

function text(value: string | null | undefined, max = 300) {
  const t = value?.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

// ---------- HTML (Netscape bookmark files, Pocket, Raindrop) ----------

function folderOf(el: Element): string | null {
  // Each folder is <DT><H3>Name</H3><DL>…</DL>; the <DL> may be a sibling of the <H3> or follow it.
  let prev = el.previousElementSibling;
  while (prev && prev.tagName === "P") prev = prev.previousElementSibling;
  return prev && (prev.tagName === "H3" || prev.tagName === "H2" || prev.tagName === "H1") ? prev.textContent : null;
}

function parseHtmlExport(doc: Document): ParsedImport {
  const folders = new Set<string>();
  const items: ImportItem[] = [];
  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const url = a.getAttribute("href")!.trim();
    if (!isWebLink(url)) continue;

    const path: string[] = [];
    let unread = false;
    for (let el = a.parentElement; el; el = el.parentElement) {
      if (el.tagName !== "DL" && el.tagName !== "UL" && el.tagName !== "OL") continue;
      const name = folderOf(el);
      if (!name) continue;
      // Pocket's export is two lists headed "Unread" and "Read Archive".
      if (name.trim().toLowerCase() === "unread") unread = true;
      path.unshift(name);
    }
    const ownTags = (a.getAttribute("tags") ?? "").split(",");
    const folderTags = cleanTags(path.slice(-3));
    for (const f of folderTags) folders.add(f);

    items.push({
      url,
      title: text(a.textContent),
      addedAt: parseWhen(a.getAttribute("add_date") ?? a.getAttribute("time_added")),
      tags: cleanTags([...[...folderTags].reverse(), ...ownTags]),
      read: !unread,
    });
  }
  return { format: "bookmarks", items, folders: folders.size };
}

// ---------- CSV ----------

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function parseCsvExport(input: string): ParsedImport | null {
  const [header, ...rows] = parseCsv(input);
  if (!header) return null;
  const cols = header.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => cols.findIndex((c) => names.includes(c));
  const urlCol = col("url", "href", "link", "address");
  if (urlCol === -1) return null;
  const titleCol = col("title", "name");
  const dateCol = col("time_added", "created", "created_at", "date_added", "added", "timestamp", "date");
  const tagsCol = col("tags", "tag", "labels");
  const folderCol = col("folder", "collection", "category");
  const statusCol = col("status");

  const folders = new Set<string>();
  const items: ImportItem[] = [];
  for (const r of rows) {
    const url = r[urlCol]?.trim() ?? "";
    if (!isWebLink(url)) continue;
    const folder = folderCol >= 0 ? cleanTag(r[folderCol] ?? "") : null;
    if (folder) folders.add(folder);
    items.push({
      url,
      title: titleCol >= 0 ? text(r[titleCol]) : null,
      addedAt: dateCol >= 0 ? parseWhen(r[dateCol]) : null,
      tags: cleanTags([folder, ...(tagsCol >= 0 ? (r[tagsCol] ?? "").split(/[|,]/) : [])]),
      read: statusCol >= 0 ? r[statusCol]?.trim().toLowerCase() !== "unread" : true,
    });
  }
  return { format: "csv", items, folders: folders.size };
}

// ---------- Plain text ----------

function parseText(input: string): ParsedImport {
  const urls = input.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  return {
    format: "text",
    items: urls
      .map((u) => u.replace(/[.,;:!?)\]]+$/, ""))
      .filter(isWebLink)
      .map((url) => ({ url, title: null, addedAt: null, tags: [], read: true })),
    folders: 0,
  };
}

// ---------- Entry point ----------

/**
 * `parseHtml` is the browser's DOMParser in the app; tests pass linkedom's. Links come back
 * de-duplicated and newest first, so a capped import keeps the most recent ones.
 */
export function parseImport(
  input: string,
  fileName: string,
  parseHtml: (html: string) => Document,
): ParsedImport {
  const name = fileName.toLowerCase();
  const looksHtml = /\.html?$/.test(name) || /<a\s[^>]*href/i.test(input.slice(0, 200_000));
  let parsed: ParsedImport | null = null;
  if (looksHtml) parsed = parseHtmlExport(parseHtml(input));
  else if (name.endsWith(".csv") || /^[^\n]*\burl\b[^\n]*,|,[^\n]*\burl\b/i.test(input.slice(0, 1000))) {
    parsed = parseCsvExport(input);
  }
  parsed ??= parseText(input);

  const seen = new Set<string>();
  const items = parsed.items
    .filter((item) => {
      const key = item.url.replace(/#.*$/, "").replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (b.item.addedAt ?? -1) - (a.item.addedAt ?? -1) || a.index - b.index)
    .map(({ item }) => item);
  return { ...parsed, items };
}
