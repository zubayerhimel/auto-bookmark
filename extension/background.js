import { connectUrl, getConfig, normalizeBase } from "./config.js";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "save-page", title: "Save page to Auto Bookmark", contexts: ["page", "selection"] });
    chrome.contextMenus.create({ id: "save-link", title: "Save link to Auto Bookmark", contexts: ["link"] });
  });
  if (details.reason === "install") {
    const { apiBase } = await getConfig();
    chrome.tabs.create({ url: connectUrl(apiBase) });
  }
});

chrome.action.onClicked.addListener((tab) => saveTab(tab));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-link" && info.linkUrl) {
    saveData(tab?.id, { url: info.linkUrl, title: info.selectionText || null });
  } else if (tab) {
    saveTab(tab);
  }
});

// ---------- Connecting to the web app ----------

chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== "complete" || !tab.url) return;
  const { apiBase } = await getConfig();
  const url = new URL(tab.url);
  if (url.origin !== apiBase || !url.pathname.startsWith("/extension")) return;
  chrome.scripting.executeScript({ target: { tabId }, files: ["connect.js"] }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "connect") return;
  (async () => {
    const { apiBase } = await getConfig();
    const senderOrigin = sender.origin || (sender.url && new URL(sender.url).origin);
    if (senderOrigin !== apiBase || typeof message.token !== "string" || !message.token.startsWith("abk_")) {
      sendResponse({ ok: false });
      return;
    }
    await chrome.storage.local.set({ token: message.token, apiBase: normalizeBase(apiBase) });
    sendResponse({ ok: true });
  })();
  return true;
});

// ---------- Saving ----------

async function saveTab(tab) {
  if (!tab?.id || !tab.url) return;
  if (!/^https?:/.test(tab.url)) {
    flash(tab.id, "!", "#B42318", "Only web pages can be saved.");
    return;
  }
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
  await saveData(tab.id, data);
}

async function saveData(tabId, data) {
  const { apiBase, token } = await getConfig();
  if (!token) {
    chrome.tabs.create({ url: connectUrl(apiBase) });
    return;
  }

  setBadge(tabId, "…", "#2446C7", "Saving…");
  let res;
  try {
    res = await fetch(`${apiBase}/api/bookmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  } catch {
    flash(tabId, "!", "#B42318", `Couldn't reach ${apiBase}. Is the app running?`);
    return;
  }

  if (res.status === 401) {
    await chrome.storage.local.remove("token");
    flash(tabId, "!", "#B42318", "Reconnect the extension to your account.");
    chrome.tabs.create({ url: connectUrl(apiBase) });
    return;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    flash(tabId, "!", "#B42318", json.error || "Couldn't save this page.");
    return;
  }

  flash(tabId, "✓", "#15803D", "Saved. Summarizing…");
  pollUntilFiled(json.id, apiBase, token);
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
  setTimeout(() => {
    setBadge(tabId, "", color, "Save to Auto Bookmark");
  }, 4000);
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
