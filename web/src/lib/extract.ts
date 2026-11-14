import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { BookmarkType } from "@/db/schema";
import { UserError } from "./errors";

export const MAX_CONTENT_CHARS = 50_000;

export type Extracted = {
  type: BookmarkType;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  siteName?: string | null;
  imageUrl?: string | null;
  publishedAt?: Date | null;
  content?: string | null;
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// ---------- URL helpers ----------

export function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|live|embed)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

export function tweetMatch(raw: string) {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^(www|mobile)\./, "");
    if (host !== "x.com" && host !== "twitter.com") return null;
    const m = u.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/);
    if (m) return { handle: m[1], id: m[2] };
  } catch {}
  return null;
}

/** "Instagram" or "Facebook" for posts on those sites; their pages sit behind a login, so the extension's capture is all we get. */
export function socialSite(raw: string): "Instagram" | "Facebook" | null {
  try {
    const host = new URL(raw).hostname.replace(/^(www|m|web|mbasic)\./, "");
    if (host === "instagram.com") return "Instagram";
    if (host === "facebook.com" || host === "fb.com") return "Facebook";
  } catch {}
  return null;
}

export function detectType(url: string): BookmarkType {
  if (youtubeId(url)) return "youtube";
  if (tweetMatch(url)) return "tweet";
  return "web";
}

const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ref_src|ref_url|igshid|igsh|img_index|mibextid|rdid|__cft__.*|__tn__|__xts__.*)$/i;

/** Canonical form used for de-duplication. */
export function normalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new UserError("That isn't a valid web address.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UserError("Only http and https links can be saved.");
  }
  const yt = youtubeId(u.toString());
  if (yt) return `https://www.youtube.com/watch?v=${yt}`;
  const tw = tweetMatch(u.toString());
  if (tw) return `https://x.com/${tw.handle}/status/${tw.id}`;
  if (socialSite(u.toString()) === "Instagram") {
    const ig = u.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/);
    if (ig) return `https://www.instagram.com/${ig[1]}/${ig[2]}/`;
  }
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  return u.toString();
}

// ---------- Safe fetching ----------

function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserError("Only http and https links can be fetched.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UserError("Private network addresses can't be fetched.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UserError("Private network addresses can't be fetched.");
  }
}

/** fetch() for user-supplied URLs: checks every redirect hop against private networks. */
async function safeFetch(raw: string, init: RequestInit = {}, timeoutMs = 15_000) {
  let current = new URL(raw);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
        ...init.headers,
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    return res;
  }
  throw new UserError("The page redirected too many times.");
}

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": USER_AGENT },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------- Link checks ----------

export type LinkHealth = "ok" | "dead" | "unknown";

async function oembedStatus(endpoint: string, timeoutMs: number, goneStatuses: number[]): Promise<LinkHealth> {
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": USER_AGENT } });
  await res.body?.cancel();
  if (res.ok) return "ok";
  return goneStatuses.includes(res.status) ? "dead" : "unknown";
}

/**
 * Whether a saved page still exists. Only a clear "gone" counts as dead (404 or 410, or a domain
 * that no longer resolves); blocks, rate limits and server errors are "unknown", since a site that
 * dislikes bots often answers 403. YouTube and X answer 200 even for removed posts, so those are
 * asked through oEmbed instead. Instagram and Facebook sit behind a login and can't be checked.
 */
export async function checkLink(url: string, timeoutMs = 10_000): Promise<LinkHealth> {
  try {
    if (socialSite(url)) return "unknown";
    if (youtubeId(url)) {
      // A removed or never-existing video is 400 (or 404); private and embed-blocked ones are 401/403.
      return await oembedStatus(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId(url)}`)}`,
        timeoutMs,
        [400, 404],
      );
    }
    const tweet = tweetMatch(url);
    if (tweet) {
      return await oembedStatus(
        `https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(`https://twitter.com/${tweet.handle}/status/${tweet.id}`)}`,
        timeoutMs,
        [404],
      );
    }
    // HEAD is cheap but some servers mishandle it, so anything other than success is retried with GET.
    let res = await safeFetch(url, { method: "HEAD" }, timeoutMs);
    if (!res.ok) {
      res = await safeFetch(url, { headers: { accept: "text/html,*/*" } }, timeoutMs);
    }
    await res.body?.cancel();
    if (res.ok) return "ok";
    return res.status === 404 || res.status === 410 ? "dead" : "unknown";
  } catch (err) {
    const code = (err as { code?: string }).code;
    return code === "ENOTFOUND" ? "dead" : "unknown";
  }
}

// ---------- Text helpers ----------

export function clip(text: string | null | undefined, max = MAX_CONTENT_CHARS) {
  if (!text) return null;
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned || null;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "dd", "details", "div", "dl", "dt", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p",
  "pre", "section", "summary", "table", "tr", "ul",
]);
const SKIP_TAGS = new Set(["script", "style", "noscript", "template", "svg", "button", "video", "audio"]);

type TextNodeLike = { nodeType: number; textContent: string | null; childNodes: ArrayLike<TextNodeLike>; tagName?: string };

/**
 * Text of an element with its structure kept as plain text: one paragraph per block (separated by
 * a blank line) and "• " before list items. textContent alone runs headings into the next paragraph.
 */
export function readableText(root: TextNodeLike | null | undefined) {
  if (!root) return null;
  const blocks: string[] = [];
  let line = "";
  let bullet = false;
  const flush = () => {
    const text = line.replace(/\s+/g, " ").trim();
    line = "";
    if (!text) return;
    blocks.push(bullet ? `• ${text}` : text);
    bullet = false;
  };
  const walk = (node: TextNodeLike) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        line += child.textContent ?? "";
      } else if (child.nodeType === 1) {
        const tag = child.tagName?.toLowerCase() ?? "";
        if (SKIP_TAGS.has(tag)) continue;
        if (tag === "br") {
          flush();
        } else if (tag === "td" || tag === "th") {
          line += " ";
          walk(child);
          line += " ";
        } else if (BLOCK_TAGS.has(tag)) {
          flush();
          if (tag === "li") bullet = true;
          walk(child);
          flush();
          if (tag === "li") bullet = false;
        } else {
          walk(child);
        }
      }
    }
  };
  walk(root);
  flush();
  return blocks.join("\n\n") || null;
}

// ---------- Generic web pages ----------

export function extractFromHtml(url: string, html: string): Extracted {
  const { document } = parseHTML(html);
  const meta = (selector: string) =>
    document.querySelector(selector)?.getAttribute("content")?.trim() || null;

  const ogTitle = meta('meta[property="og:title"]') ?? meta('meta[name="twitter:title"]');
  const description =
    meta('meta[property="og:description"]') ??
    meta('meta[name="description"]') ??
    meta('meta[name="twitter:description"]');
  let imageUrl = meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]');
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, url).toString();
    } catch {
      imageUrl = null;
    }
  }
  const siteName = meta('meta[property="og:site_name"]');
  const publishedAt = parseDate(
    meta('meta[property="article:published_time"]') ??
      document.querySelector("time[datetime]")?.getAttribute("datetime"),
  );
  const metaAuthor = meta('meta[name="author"]') ?? meta('meta[property="article:author"]');
  const docTitle = document.querySelector("title")?.textContent?.trim() || null;

  let article: ReturnType<Readability["parse"]> = null;
  try {
    article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  } catch {
    article = null;
  }
  let text: string | null = null;
  if (article?.content) {
    const parsed = parseHTML(`<!doctype html><html><body>${article.content}</body></html>`);
    text = readableText(parsed.document.body as unknown as TextNodeLike);
  }
  // Readability empties the document as it goes, so the fallback reads what's left of the body.
  text ||= readableText(document.body as unknown as TextNodeLike) ?? article?.textContent ?? null;

  return {
    type: "web",
    title: ogTitle ?? article?.title ?? docTitle,
    description: description ?? article?.excerpt ?? null,
    author: article?.byline ?? metaAuthor,
    siteName: siteName ?? article?.siteName ?? new URL(url).hostname.replace(/^www\./, ""),
    imageUrl,
    publishedAt,
    content: clip(text),
  };
}

async function extractWeb(url: string): Promise<Extracted> {
  const res = await safeFetch(url, { headers: { accept: "text/html,application/xhtml+xml" } });
  if (!res.ok) throw new UserError(`The page responded with HTTP ${res.status}.`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    return {
      type: "web",
      title: new URL(url).pathname.split("/").pop() || url,
      siteName: new URL(url).hostname.replace(/^www\./, ""),
      content: contentType.startsWith("text/") ? clip(await res.text()) : null,
    };
  }
  const html = (await res.text()).slice(0, 3_000_000);
  return extractFromHtml(url, html);
}

// ---------- X / Twitter ----------

async function extractTweet(url: string): Promise<Extracted> {
  const data = await fetchJson<{ html?: string; author_name?: string; author_url?: string }>(
    `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url)}`,
  );
  let text: string | null = null;
  let publishedAt: Date | null = null;
  if (data?.html) {
    const { document } = parseHTML(`<html><body>${data.html}</body></html>`);
    const p = document.querySelector("blockquote p");
    text = p?.textContent?.trim() ?? null;
    const links = document.querySelectorAll("blockquote > a");
    publishedAt = parseDate(links[links.length - 1]?.textContent ?? null);
  }
  const handle = tweetMatch(url)?.handle;
  return {
    type: "tweet",
    title: text ? text.slice(0, 120) : `Post by @${handle}`,
    author: data?.author_name ? `${data.author_name} (@${handle})` : `@${handle}`,
    siteName: "X",
    publishedAt,
    content: clip(text),
  };
}

// ---------- YouTube ----------

type PlayerResponse = {
  videoDetails?: {
    title?: string;
    author?: string;
    shortDescription?: string;
    keywords?: string[];
    lengthSeconds?: string;
  };
  microformat?: { playerMicroformatRenderer?: { publishDate?: string; uploadDate?: string } };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: { baseUrl: string; languageCode: string; kind?: string }[];
    };
  };
};

function parsePlayerResponse(html: string): PlayerResponse | null {
  const marker = "ytInitialPlayerResponse = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  // Walk braces to find the end of the JSON object.
  let depth = 0;
  let inString = false;
  let escaped = false;
  const from = start + marker.length;
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(from, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function fetchYoutubeTranscript(player: PlayerResponse | null) {
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) return null;
  const track =
    tracks.find((t) => t.languageCode.startsWith("en") && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode.startsWith("en")) ??
    tracks[0];
  const data = await fetchJson<{ events?: { segs?: { utf8?: string }[] }[] }>(
    `${track.baseUrl}&fmt=json3`,
  );
  const text = data?.events
    ?.flatMap((e) => e.segs?.map((s) => s.utf8 ?? "") ?? [])
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

export async function extractYoutube(url: string): Promise<Extracted> {
  const id = youtubeId(url)!;
  const [oembed, page] = await Promise.all([
    fetchJson<{ title?: string; author_name?: string; thumbnail_url?: string }>(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    ),
    fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      signal: AbortSignal.timeout(12_000),
      headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" },
    })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null),
  ]);

  const player = page ? parsePlayerResponse(page) : null;
  const details = player?.videoDetails;
  const transcript = await fetchYoutubeTranscript(player).catch(() => null);

  const parts = [
    details?.shortDescription && `Description:\n${details.shortDescription}`,
    details?.keywords?.length && `Keywords: ${details.keywords.join(", ")}`,
    transcript && `Transcript:\n${transcript}`,
  ].filter(Boolean);

  const micro = player?.microformat?.playerMicroformatRenderer;
  return {
    type: "youtube",
    title: oembed?.title ?? details?.title ?? null,
    author: oembed?.author_name ?? details?.author ?? null,
    siteName: "YouTube",
    description: details?.shortDescription?.slice(0, 500) ?? null,
    imageUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    publishedAt: parseDate(micro?.publishDate ?? micro?.uploadDate),
    content: clip(parts.join("\n\n")),
  };
}

// ---------- Entry point ----------

export async function extractFromUrl(url: string): Promise<Extracted> {
  const type = detectType(url);
  if (type === "youtube") return extractYoutube(url);
  if (type === "tweet") return extractTweet(url);
  return extractWeb(url);
}
