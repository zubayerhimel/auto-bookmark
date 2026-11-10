import { connectUrl, getConfig } from "./config.js";

const POLL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

const main = document.getElementById("main");
const header = document.getElementById("header");
const footer = document.getElementById("footer");
const searchForm = document.getElementById("search-form");
const q = document.getElementById("q");

let config;
let tab;
/** Latest render of the current page; kept up to date while search results are showing. */
let pageView = [];
let searching = false;
let polling = 0;

// ---------- Helpers ----------

/** Builds DOM with textContent only: titles and summaries come from arbitrary web pages. */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "style") Object.assign(el.style, value);
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** A white card with a ribbon hanging from its top edge. `flag` is a colour, "pending", or { color, drop }. */
function sheet(flag, ...children) {
  const opts = typeof flag === "object" && flag ? flag : { color: flag };
  const ribbon =
    opts.color === "pending"
      ? h("i", { class: "pending" })
      : h("i", { class: opts.drop ? "drop" : null, style: { background: opts.color } });
  return h("div", { class: "sheet" }, h("span", { class: "flag", "aria-hidden": "true" }, ribbon), ...children);
}

function show(...nodes) {
  main.replaceChildren(...nodes.filter(Boolean));
}

/** Renders the current page's state, unless search results are on screen. */
function showPage(...nodes) {
  pageView = nodes.filter(Boolean);
  if (!searching) main.replaceChildren(...pageView);
}

function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  const steps = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let n = seconds;
  for (const [size, unit] of steps) {
    if (n < size) {
      const whole = Math.floor(n);
      return whole <= 0 && unit === "second" ? "just now" : `${whole} ${unit}${whole === 1 ? "" : "s"} ago`;
    }
    n /= size;
  }
  return "";
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function openTab(url) {
  chrome.tabs.create({ url });
  window.close();
}

class Unauthorized extends Error {}

async function api(path, init = {}) {
  let res;
  try {
    res = await fetch(`${config.apiBase}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${config.token}` },
    });
  } catch {
    throw new Error(`Couldn't reach ${config.apiBase}. Is the app running?`);
  }
  if (res.status === 401) {
    await chrome.storage.local.remove("token");
    throw new Unauthorized();
  }
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json;
}

function handleError(err) {
  if (err instanceof Unauthorized) return renderConnect("Your session with the extension expired. Connect again to keep saving.");
  renderError(err.message);
}

// ---------- Views ----------

function renderConnect(message = "Sign in to start saving pages. Auto Bookmark summarizes and files them for you.") {
  searching = false;
  polling++;
  header.hidden = true;
  footer.hidden = true;
  show(
    sheet(
      "var(--action)",
      h("p", { class: "title" }, "Connect your account"),
      h("p", { class: "muted" }, message),
      h("div", { class: "actions" }, h("button", { class: "btn primary", onclick: () => openTab(connectUrl(config.apiBase)) }, "Sign in and connect")),
    ),
  );
}

function renderError(message, retry) {
  showPage(
    sheet(
      "var(--danger)",
      h("div", { class: "status err" }, "Couldn't save this page"),
      h("p", { class: "title" }, tab?.title || hostOf(tab?.url ?? "")),
      h("p", { class: "muted" }, message),
      retry ? h("div", { class: "actions" }, h("button", { class: "btn primary", onclick: retry }, "Try again")) : null,
    ),
  );
}

function renderSaving(label) {
  showPage(
    sheet(
      "pending",
      h("div", { class: "status" }, h("span", { class: "spinner" }), label),
      h("p", { class: "title" }, tab.title || hostOf(tab.url)),
      h("div", { class: "site" }, hostOf(tab.url)),
      h("div", { class: "skeleton", style: { width: "100%", marginTop: "14px" } }),
      h("div", { class: "skeleton", style: { width: "92%" } }),
      h("div", { class: "skeleton", style: { width: "64%" } }),
    ),
  );
}

function renderBookmark(b, { fresh }) {
  const status =
    b.status === "failed"
      ? h("div", { class: "status err" }, "Saved, but the summary failed")
      : b.status === "ready"
        ? h("div", { class: "status ok" }, fresh ? "Saved and filed" : `Saved ${timeAgo(b.createdAt)}`)
        : h("div", { class: "status" }, h("span", { class: "spinner" }), "Summarizing…");
  const flag =
    b.status === "failed"
      ? "var(--danger)"
      : b.status === "ready"
        ? { color: b.category?.color ?? "var(--rule)", drop: fresh }
        : "pending";

  const body =
    b.status === "ready"
      ? [
          b.summary ? h("p", { class: "summary" }, b.summary) : null,
          h(
            "div",
            { class: "meta" },
            h("span", { class: "category", style: { color: b.category?.color } }, b.category?.name ?? "Uncategorized"),
            ...(b.tags ?? []).slice(0, 4).map((t) => h("span", { class: "tag" }, `#${t}`)),
          ),
        ]
      : b.status === "failed"
        ? [h("p", { class: "muted" }, b.error || "Retry it from your library.")]
        : [
            h("div", { class: "skeleton", style: { width: "100%", marginTop: "14px" } }),
            h("div", { class: "skeleton", style: { width: "88%" } }),
          ];

  const remove = h("button", { class: "btn danger", onclick: () => removeBookmark(b, remove) }, fresh ? "Undo" : "Remove");
  showPage(
    sheet(
      flag,
      status,
      h("p", { class: "title" }, b.title || tab.title || hostOf(b.url)),
      h("div", { class: "site" }, hostOf(b.url)),
      ...body,
      h(
        "div",
        { class: "actions" },
        h("button", { class: "btn primary", onclick: () => openTab(`${config.apiBase}/library/${b.id}`) }, "Open in library"),
        b.status === "failed" ? h("button", { class: "btn", onclick: savePage }, "Try again") : null,
        remove,
      ),
    ),
  );
}

function renderRemoved() {
  showPage(
    sheet(
      "var(--rule)",
      h("div", { class: "status" }, "Removed"),
      h("p", { class: "title" }, tab.title || hostOf(tab.url)),
      h("p", { class: "muted" }, "This page is no longer in your library."),
      h("div", { class: "actions" }, h("button", { class: "btn primary", onclick: savePage }, "Save it again")),
    ),
  );
}

function renderUnsavable() {
  showPage(
    sheet(
      "var(--rule)",
      h("p", { class: "title" }, "Nothing to save here"),
      h("p", { class: "muted" }, "Open a web page, post or YouTube video to save it. You can still search your library above."),
    ),
  );
}

// ---------- Page flow ----------

async function savePage() {
  const run = ++polling;
  renderSaving("Saving…");
  let result;
  try {
    result = await chrome.runtime.sendMessage({ type: "save", tabId: tab.id });
  } catch {
    result = { ok: false, error: "The extension isn't responding. Try again." };
  }
  if (!result?.ok) {
    if (result?.reconnect) return renderConnect(result.error);
    return renderError(result?.error ?? "Couldn't save this page.", savePage);
  }
  renderSaving("Summarizing…");
  await pollBookmark(result.id, run);
}

async function pollBookmark(id, run) {
  const started = Date.now();
  while (run === polling && Date.now() - started < POLL_TIMEOUT_MS) {
    let b;
    try {
      b = await api(`/api/bookmarks/${id}`);
    } catch (err) {
      return handleError(err);
    }
    if (run !== polling) return;
    renderBookmark(b, { fresh: true });
    if (b.status === "ready" || b.status === "failed") return;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function removeBookmark(b, button) {
  button.disabled = true;
  polling++;
  try {
    await api(`/api/bookmarks/${b.id}`, { method: "DELETE" });
  } catch (err) {
    button.disabled = false;
    return handleError(err);
  }
  chrome.runtime.sendMessage({ type: "indicator", tabId: tab.id, url: tab.url, saved: false }).catch(() => {});
  renderRemoved();
}

// ---------- Search ----------

let searchRun = 0;

async function runSearch(query) {
  const run = ++searchRun;
  searching = true;
  show(
    h("div", { class: "status" }, h("span", { class: "spinner" }), "Searching…"),
    h("div", { class: "skeleton", style: { width: "70%" } }),
    h("div", { class: "skeleton", style: { width: "95%" } }),
    h("div", { class: "skeleton", style: { width: "60%", marginTop: "18px" } }),
    h("div", { class: "skeleton", style: { width: "90%" } }),
  );
  let data;
  try {
    data = await api(`/api/search?q=${encodeURIComponent(query)}`);
  } catch (err) {
    if (run !== searchRun) return;
    if (err instanceof Unauthorized) return handleError(err);
    return show(
      h("div", { class: "status err split" }, "Search failed", h("button", { class: "link", type: "button", onclick: clearSearch }, "Back to this page")),
      h("p", { class: "muted" }, err.message),
    );
  }
  if (run !== searchRun) return;

  const back = h("button", { class: "link", type: "button", onclick: clearSearch }, "Back to this page");
  const u = data.understood;
  const understood =
    u && (u.type || u.category || u.savedAfter || u.savedBefore)
      ? h(
          "p",
          { class: "understood" },
          "Looking for ",
          [
            u.searchText ? h("q", {}, u.searchText) : null,
            u.type ? { web: "web pages", tweet: "posts on X", youtube: "YouTube videos" }[u.type] : null,
            u.category ? `in ${u.category}` : null,
            u.savedAfter ? `saved after ${new Date(u.savedAfter).toLocaleDateString()}` : null,
            u.savedBefore ? `saved before ${new Date(u.savedBefore).toLocaleDateString()}` : null,
          ]
            .filter(Boolean)
            .flatMap((part, i) => (i ? [" ", part] : [part])),
        )
      : null;

  const results = data.results.slice(0, 8);
  show(
    h("div", { class: "status split" }, `${data.results.length} result${data.results.length === 1 ? "" : "s"}`, back),
    understood,
    results.length === 0
      ? h("p", { class: "muted" }, "Nothing matches. Try describing it differently.")
      : h(
          "ul",
          { class: "results" },
          results.map((r) =>
            h(
              "li",
              {},
              h(
                "button",
                { class: "result", type: "button", title: r.url, onclick: () => openTab(r.url) },
                h("p", { class: "title" }, r.title || hostOf(r.url)),
                r.summary || r.description ? h("p", { class: "summary" }, r.summary || r.description) : null,
                h(
                  "div",
                  { class: "row" },
                  h(
                    "span",
                    { class: "cat" },
                    h("i", { class: "mark", style: { background: r.categoryColor || "var(--rule)" } }),
                    r.categoryName || "Uncategorized",
                  ),
                  h("span", {}, hostOf(r.url)),
                  h("span", {}, timeAgo(r.createdAt)),
                ),
              ),
            ),
          ),
        ),
    data.results.length > results.length
      ? h("div", { class: "actions" }, h("button", { class: "link", type: "button", onclick: () => openTab(`${config.apiBase}/library?q=${encodeURIComponent(query)}`) }, `See all ${data.results.length} in the library`))
      : null,
  );
}

function clearSearch() {
  searchRun++;
  searching = false;
  q.value = "";
  main.replaceChildren(...pageView);
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = q.value.trim();
  if (query) runSearch(query);
  else clearSearch();
});

q.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && q.value) {
    e.preventDefault();
    clearSearch();
  }
});

q.addEventListener("search", () => {
  if (!q.value) clearSearch();
});

// ---------- Start ----------

document.getElementById("open-library").addEventListener("click", () => openTab(`${config.apiBase}/library`));
document.getElementById("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

async function loadAccount() {
  try {
    const me = await api("/api/me");
    document.getElementById("who").textContent = me?.email || me?.name || "";
  } catch {
    // The page flow reports connection problems.
  }
}

async function start() {
  if (!tab?.url || !/^https?:/.test(tab.url) || tab.url.startsWith(`${config.apiBase}/`)) return renderUnsavable();
  showPage(h("div", { class: "skeleton", style: { width: "40%" } }), h("div", { class: "skeleton", style: { width: "85%", marginTop: "12px" } }));
  let found;
  try {
    found = await api(`/api/bookmarks?url=${encodeURIComponent(tab.url)}`);
  } catch (err) {
    return handleError(err);
  }
  if (!found.bookmark) return savePage();
  const b = found.bookmark;
  renderBookmark(b, { fresh: false });
  if (b.status === "pending" || b.status === "processing") pollBookmark(b.id, ++polling);
}

(async () => {
  config = await getConfig();
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!config.token) return renderConnect();
  header.hidden = false;
  footer.hidden = false;
  loadAccount();
  start();
})();
