import { connectUrl, DEFAULT_API_BASE, getConfig, LOCAL_API_BASE, normalizeBase } from "./config.js";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;
/** Sites where posts.js adds per-post save buttons (keep in sync with manifest.json). */
const POST_SITES = [
  "https://x.com/*",
  "https://twitter.com/*",
  "https://www.instagram.com/*",
  "https://www.facebook.com/*",
  "https://web.facebook.com/*",
];

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "save-page", title: "Save page to Auto Bookmark", contexts: ["page", "selection"] });
    chrome.contextMenus.create({ id: "save-link", title: "Save link to Auto Bookmark", contexts: ["link"] });
    chrome.contextMenus.create({
      id: "save-post",
      title: "Save this post to Auto Bookmark",
      contexts: ["page", "selection", "link", "image", "video"],
      documentUrlPatterns: POST_SITES,
    });
  });
  // Content scripts only load on new page loads; add the post buttons to tabs that are already open.
  const tabs = await chrome.tabs.query({ url: POST_SITES });
  for (const t of tabs) {
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["posts.js"] }).catch(() => {});
  }
  if (details.reason === "update") {
    // Installs from before the app was deployed point at localhost; move them to the live app.
    const { apiBase } = await chrome.storage.local.get("apiBase");
    if (apiBase === LOCAL_API_BASE) await chrome.storage.local.set({ apiBase: DEFAULT_API_BASE });
  }
  if (details.reason === "install") {
    const { apiBase } = await getConfig();
    chrome.tabs.create({ url: connectUrl(apiBase) });
  }
});

// Clicking the toolbar button opens popup.html, which asks this worker to save (see "save" below),
// so saving and polling carry on even after the popup closes.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-post") {
    // posts.js remembers which post was right-clicked and saves it like its own button does.
    const res = await chrome.tabs.sendMessage(tab.id, { type: "saveContextPost" }).catch(() => null);
    if (!res?.ok) flash(tab.id, "!", "#B42318", "Couldn't find a post there. Reload the page and try again.");
    return;
  }
  const result =
    info.menuItemId === "save-link" && info.linkUrl
      ? await saveData(tab?.id, { url: info.linkUrl, title: info.selectionText || null })
      : tab
        ? await saveTab(tab)
        : null;
  if (!result || result.ok) return;
  flash(tab?.id, "!", "#B42318", result.error);
  if (result.reconnect) {
    const { apiBase } = await getConfig();
    chrome.tabs.create({ url: connectUrl(apiBase) });
  }
});

// ---------- Connecting to the web app ----------

chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (!tab.url) return;
  // Single-page sites (YouTube, X) change the URL without a full load.
  if (change.url || change.status === "complete") refreshIndicator(tabId, tab.url);
  if (change.status !== "complete") return;
  const { apiBase } = await getConfig();
  const url = new URL(tab.url);
  if (url.origin !== apiBase || !url.pathname.startsWith("/extension")) return;
  chrome.scripting.executeScript({ target: { tabId }, files: ["connect.js"] }).catch(() => {});
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url) refreshIndicator(tabId, tab.url);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // From popup.html (an extension page, so sender.id is ours and there is no sender.tab).
  if (sender.id === chrome.runtime.id && !sender.tab) {
    if (message?.type === "save") {
      chrome.tabs
        .get(message.tabId)
        .then(saveTab)
        .then(sendResponse, () => sendResponse({ ok: false, error: "That tab is gone." }));
      return true;
    }
    if (message?.type === "indicator") {
      savedCache.set(message.url, { saved: message.saved, at: Date.now() });
      showIndicator(message.tabId, message.saved);
      return;
    }
  }
  // From posts.js, our content script on X, Instagram and Facebook.
  if (sender.id === chrome.runtime.id && sender.tab) {
    if (message?.type === "savePost" && message.data?.url) {
      saveData(sender.tab.id, message.data).then(async (result) => {
        if (result.ok) savedCache.set(message.data.url, { saved: true, at: Date.now() });
        else if (result.reconnect) chrome.tabs.create({ url: connectUrl((await getConfig()).apiBase) });
        sendResponse(result);
      });
      return true;
    }
    if (message?.type === "lookupPost" && message.url) {
      isSaved(message.url).then((saved) => sendResponse({ saved }));
      return true;
    }
  }
  if (message?.type !== "connect") return;
  (async () => {
    const { apiBase } = await getConfig();
    const senderOrigin = sender.origin || (sender.url && new URL(sender.url).origin);
    if (senderOrigin !== apiBase || typeof message.token !== "string" || !message.token.startsWith("abk_")) {
      sendResponse({ ok: false });
      return;
    }
    await chrome.storage.local.set({ token: message.token, apiBase: normalizeBase(apiBase) });
    savedCache.clear();
    sendResponse({ ok: true });
  })();
  return true;
});

// ---------- "Already saved" indicator ----------

const CACHE_MS = 5 * 60_000;
/** url -> { saved, at }. Lives as long as the service worker; that's fine, it's only a cache. */
const savedCache = new Map();

function showIndicator(tabId, saved) {
  if (saved) setBadge(tabId, "✓", "#15803D", "Saved to Auto Bookmark. Click to see it.");
  else setBadge(tabId, "", "#15803D", "Save to Auto Bookmark");
}

async function refreshIndicator(tabId, url) {
  if (tabId == null || !/^https?:/.test(url)) return;
  const { apiBase, token } = await getConfig();
  if (!token || url.startsWith(`${apiBase}/`)) return;

  const saved = await isSaved(url);
  if (saved == null) return;
  // The tab may have moved on while we were asking.
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url === url) showIndicator(tabId, saved);
}

/** Whether this URL is in the library: true, false, or null when we can't tell. */
async function isSaved(url) {
  const cached = savedCache.get(url);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.saved;
  const { apiBase, token } = await getConfig();
  if (!token) return null;
  try {
    const res = await fetch(`${apiBase}/api/bookmarks?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const saved = Boolean((await res.json()).bookmark);
    savedCache.set(url, { saved, at: Date.now() });
    return saved;
  } catch {
    return null;
  }
}

// ---------- Saving ----------

/** Saves the page in a tab. Resolves to { ok: true, id } or { ok: false, error, reconnect? }. */
async function saveTab(tab) {
  if (!tab?.id || !tab.url) return { ok: false, error: "There's no page to save here." };
  if (!/^https?:/.test(tab.url)) return { ok: false, error: "Only web pages can be saved." };
  let data = { url: tab.url, title: tab.title };
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: capturePage,
    });
    if (result?.result) data = { ...data, ...result.result };
  } catch {
    // Some pages (e.g. the Chrome Web Store) block scripts; the server fetches the page instead.
  }
  const saved = await saveData(tab.id, data);
  if (saved.ok) {
    savedCache.set(tab.url, { saved: true, at: Date.now() });
    showIndicator(tab.id, true);
  }
  return saved;
}

async function saveData(tabId, data) {
  const { apiBase, token } = await getConfig();
  if (!token) return { ok: false, reconnect: true, error: "Connect the extension to your account first." };

  setBadge(tabId, "…", "#2446C7", "Saving…");
  let res;
  try {
    res = await fetch(`${apiBase}/api/bookmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  } catch {
    restoreIndicator(tabId);
    return { ok: false, error: `Couldn't reach ${apiBase}. Is the app running?` };
  }

  if (res.status === 401) {
    await chrome.storage.local.remove("token");
    restoreIndicator(tabId);
    return { ok: false, reconnect: true, error: "Reconnect the extension to your account." };
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    restoreIndicator(tabId);
    return { ok: false, error: json.error || "Couldn't save this page." };
  }

  flash(tabId, "✓", "#15803D", "Saved. Summarizing…");
  pollUntilFiled(json.id, apiBase, token);
  return { ok: true, id: json.id };
}

async function pollUntilFiled(id, apiBase, token) {
  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    // Any extension API call resets the service worker's idle timer so polling can finish.
    await chrome.runtime.getPlatformInfo();
    let item;
    try {
      const res = await fetch(`${apiBase}/api/bookmarks/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      item = await res.json();
    } catch {
      return;
    }
    if ((item.status === "ready" || item.status === "failed") && (await popupIsOpen())) return;
    if (item.status === "ready") {
      notify(id, `Filed under ${item.category?.name ?? "Uncategorized"}`, item.title || item.url, item.summary);
      return;
    }
    if (item.status === "failed") {
      notify(id, "Saved, but the summary failed", item.title || item.url, item.error || "Retry it from your library.");
      return;
    }
  }
}

function notify(id, title, itemTitle, body) {
  chrome.notifications.create(`bookmark:${id}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: itemTitle,
    contextMessage: body ? body.slice(0, 120) : undefined,
    priority: 0,
  });
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith("bookmark:")) return;
  const { apiBase } = await getConfig();
  chrome.tabs.create({ url: `${apiBase}/library/${notificationId.slice("bookmark:".length)}` });
  chrome.notifications.clear(notificationId);
});

function setBadge(tabId, text, color, title) {
  if (tabId == null) return;
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setTitle({ tabId, title }).catch(() => {});
}

function flash(tabId, text, color, title) {
  setBadge(tabId, text, color, title);
  setTimeout(() => restoreIndicator(tabId), 4000);
}

/** Puts the badge back to "saved" or blank for whatever page the tab now shows. */
async function restoreIndicator(tabId) {
  if (tabId == null) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  const entry = tab.url && savedCache.get(tab.url);
  showIndicator(tabId, Boolean(entry?.saved));
}

/** The popup shows the result itself, so a notification would be noise. */
async function popupIsOpen() {
  try {
    return (await chrome.runtime.getContexts({ contextTypes: ["POPUP"] })).length > 0;
  } catch {
    return false;
  }
}

// Runs inside the page (MAIN world) and must be self-contained.
function capturePage() {
  const meta = (sel) => document.querySelector(sel)?.getAttribute("content")?.trim() || null;
  const selection = String(window.getSelection?.() ?? "").trim() || null;
  const host = location.hostname.replace(/^www\.|^m\./, "");

  if (host === "x.com" || host === "twitter.com") {
    const match = location.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (match) {
      const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
      const article =
        articles.find((a) => a.querySelector(`a[href*="/status/${match[2]}"] time`)) || articles[0] || null;
      const text = article?.querySelector('[data-testid="tweetText"]')?.innerText?.trim() || null;
      const name = article?.querySelector('[data-testid="User-Name"]')?.innerText?.split("\n") ?? [];
      const time = article?.querySelector("time")?.getAttribute("datetime") || null;
      const image = article?.querySelector('[data-testid="tweetPhoto"] img')?.src || null;
      const author = name[0] ? `${name[0]}${name[1] ? ` (${name[1]})` : ""}` : `@${match[1]}`;
      return {
        url: location.href,
        title: text ? `${name[0] || match[1]} on X: “${text.slice(0, 80)}${text.length > 80 ? "…" : ""}”` : document.title,
        author,
        siteName: "X",
        content: text,
        publishedAt: time,
        imageUrl: image,
        note: selection,
      };
    }
  }

  if (host === "youtube.com" || host === "youtu.be") {
    const videoId =
      new URLSearchParams(location.search).get("v") ||
      location.pathname.match(/^\/(?:shorts|live)\/([\w-]{6,})/)?.[1] ||
      null;
    if (videoId) {
      const details = window.ytInitialPlayerResponse?.videoDetails;
      const fresh = details?.videoId === videoId ? details : null;
      const micro = window.ytInitialPlayerResponse?.microformat?.playerMicroformatRenderer;
      const title =
        fresh?.title ||
        document.querySelector("ytd-watch-metadata h1")?.textContent?.trim() ||
        document.title.replace(/ - YouTube$/, "");
      const description =
        fresh?.shortDescription ||
        document.querySelector("ytd-text-inline-expander #snippet-text, #description-inline-expander")?.innerText?.trim() ||
        null;
      const channel =
        fresh?.author || document.querySelector("ytd-channel-name#channel-name a, #owner #channel-name a")?.textContent?.trim() || null;
      return {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title,
        author: channel,
        siteName: "YouTube",
        description: description?.slice(0, 2000) || null,
        content: [description, fresh?.keywords?.length ? `Keywords: ${fresh.keywords.join(", ")}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        imageUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: (fresh && micro?.publishDate) || null,
        note: selection,
      };
    }
  }

  let html = null;
  try {
    html = document.documentElement.outerHTML;
    if (html.length > 2_000_000) html = html.slice(0, 2_000_000);
  } catch {
    html = null;
  }
  return {
    url: location.href,
    title: meta('meta[property="og:title"]') || document.title || null,
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    imageUrl: meta('meta[property="og:image"]'),
    siteName: meta('meta[property="og:site_name"]'),
    author: meta('meta[name="author"]'),
    publishedAt: meta('meta[property="article:published_time"]'),
    html,
    note: selection,
  };
}
