// Adds a "save this post" button to posts on X, Instagram and Facebook.
// X gets a button in each post's action bar; Instagram and Facebook (whose markup is obfuscated)
// get one floating button that follows the post under the mouse. Right-click > "Save this post"
// works everywhere as a fallback.
(() => {
  if (window.__autoBookmarkPosts) return;
  window.__autoBookmarkPosts = true;

  const host = location.hostname.replace(/^(www|mobile|m|web)\./, "");
  const site =
    host === "x.com" || host === "twitter.com"
      ? "x"
      : host === "instagram.com"
        ? "instagram"
        : host === "facebook.com"
          ? "facebook"
          : null;
  if (!site) return;

  // Buttons left behind by a previous copy of the extension (before an update or reload) are dead.
  document.querySelectorAll("auto-bookmark-save, auto-bookmark-toast").forEach((n) => n.remove());

  /** Messages the service worker; null if it fails (e.g. the extension was reloaded under this page). */
  async function send(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      return chrome.runtime?.id ? null : { ok: false, error: "Auto Bookmark was updated. Reload this page to save posts." };
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (text) => (text ?? "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const short = (text, n = 80) => (text.length > n ? `${text.slice(0, n).trimEnd()}…` : text);
  const absolute = (href) => {
    try {
      return new URL(href, location.href).href;
    } catch {
      return null;
    }
  };

  /** Largest picture in the post, plus every image description (Instagram and Facebook write good ones). */
  function images(post) {
    const imgs = [...post.querySelectorAll("img")]
      .map((img) => ({ img, rect: img.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width >= 120 && rect.height >= 120);
    imgs.sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);
    const alts = [...new Set(imgs.map(({ img }) => img.alt?.trim()).filter((alt) => alt && alt.length > 12))];
    return { imageUrl: imgs[0]?.img.currentSrc || imgs[0]?.img.src || null, alts };
  }

  /** Post text without button labels, counters and timestamps. */
  function visibleText(post, junk) {
    return clean(
      post.innerText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line !== "·" && line !== "•" && !junk.test(line))
        .join("\n"),
    );
  }

  // ---------- Per-site capture ----------

  const SITES = {
    x: {
      name: "X",
      findPost: (el) => el.closest?.('article[data-testid="tweet"]') ?? null,
      permalink(post) {
        const a = [...post.querySelectorAll('a[href*="/status/"]')].find((link) => link.querySelector("time"));
        const m = a && new URL(a.href).pathname.match(/^\/([^/]+)\/status\/(\d+)/);
        return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
      },
      capture(post, url) {
        const texts = [...post.querySelectorAll('[data-testid="tweetText"]')].map((el) => el.innerText.trim());
        const name = post.querySelector('[data-testid="User-Name"]')?.innerText?.split("\n") ?? [];
        const handle = new URL(url).pathname.split("/")[1];
        const author = name[0] ? `${name[0]} (@${handle})` : `@${handle}`;
        const text = texts[0] ?? "";
        const { imageUrl, alts } = images(post);
        return {
          title: text ? `${name[0] || handle} on X: “${short(text)}”` : `Post by @${handle} on X`,
          author,
          content: [text, texts[1] ? `Quoting: ${texts[1]}` : null, ...alts.map((a) => `Image: ${a}`)].filter(Boolean).join("\n\n"),
          imageUrl: post.querySelector('[data-testid="tweetPhoto"] img')?.src || imageUrl,
          publishedAt: post.querySelector("time")?.getAttribute("datetime") || null,
        };
      },
    },

    instagram: {
      name: "Instagram",
      floating: { right: 44, top: 10 },
      findPost: (el) => el.closest?.("article") ?? null,
      permalink(post) {
        for (const a of post.querySelectorAll("a[href]")) {
          const m = new URL(a.href).pathname.match(/^\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/);
          if (m) return `https://www.instagram.com/${m[1]}/${m[2]}/`;
        }
        const m = location.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/);
        return m ? `https://www.instagram.com/${m[1]}/${m[2]}/` : null;
      },
      capture(post) {
        const author =
          [...post.querySelectorAll('a[href^="/"]')]
            .map((a) => ({ path: a.getAttribute("href"), text: a.innerText.trim() }))
            .find(({ path, text }) => /^\/[\w.]+\/?$/.test(path) && text && path.replace(/\//g, "") === text)?.text ?? null;
        const caption =
          post.querySelector("h1")?.innerText?.trim() ||
          visibleText(
            post,
            /^(follow|following|more|… ?more|like|reply|share|save|add a comment…?|original audio|sponsored|verified|see translation|view (all )?[\d,.]+ (comments?|replies)|[\d,.]+[kmb]? (likes?|views?|comments?|plays?)|liked by .*|\d+ ?[smhdw]|\d+ (seconds?|minutes?|hours?|days?|weeks?) ago)$/i,
          );
        const { imageUrl, alts } = images(post);
        const text = author && caption.startsWith(author) ? caption.slice(author.length).trim() : caption;
        return {
          title: `${author ?? "Post"} on Instagram${text ? `: “${short(text)}”` : ""}`,
          author,
          content: [text, ...alts.map((a) => `Image: ${a}`)].filter(Boolean).join("\n\n"),
          imageUrl,
          publishedAt: post.querySelector("time[datetime]")?.getAttribute("datetime") || null,
        };
      },
    },

    facebook: {
      name: "Facebook",
      floating: { right: 100, top: 14, inset: 64 },
      /** The outermost post container, so comments (also role=article) resolve to their post. */
      findPost(el) {
        let found = null;
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          if (n.matches?.('[aria-posinset], [role="article"], [data-pagelet^="FeedUnit"]')) found = n;
        }
        if (!found) return null;
        const rect = found.getBoundingClientRect();
        return rect.width > 280 && rect.height > 120 ? found : null;
      },
      permalink(post) {
        const PERMA = /\/(posts|permalink|videos|reel|photos?|watch|share\/[pv])\b|story_fbid=|[?&]fbid=|\/photo\/?\?/;
        for (const a of post.querySelectorAll("a[href]")) {
          const href = absolute(a.getAttribute("href"));
          if (href && PERMA.test(href) && !/comment_id=/.test(href)) return href;
        }
        return null;
      },
      /** Facebook fills in timestamp links only when they're hovered or focused. */
      async revealPermalink(post) {
        const pending = [...post.querySelectorAll('a[role="link"][href="#"], a[role="link"]:not([href])')].slice(0, 8);
        for (const a of pending) {
          a.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
          a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        }
        await sleep(120);
        for (const a of pending) {
          a.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
          a.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
        }
      },
      capture(post) {
        const author =
          post.querySelector('[data-ad-rendering-role="profile_name"]')?.innerText?.trim() ||
          post.querySelector("h2 a, h3 a, h4 a, strong a, h2, h3, h4")?.innerText?.trim() ||
          null;
        const message = [...post.querySelectorAll('[data-ad-preview="message"], [data-ad-comet-preview="message"], [data-ad-rendering-role="story_message"]')]
          .map((el) => el.innerText.trim())
          .filter(Boolean)
          .join("\n\n");
        const text =
          message ||
          visibleText(
            post,
            /^(like|comment|share|reply|follow|send|see more|see less|see translation|most relevant|write a (public )?comment…?|all reactions:?|sponsored|[\d,.]+[km]?( (comments?|shares?|views?|reactions?))?|\d+ ?[smhdwy]|just now)$/i,
          );
        const { imageUrl, alts } = images(post);
        return {
          title: `${author ?? "Post"} on Facebook${text ? `: “${short(text.replace(author ?? "", "").trim())}”` : ""}`,
          author,
          content: [text, ...alts.map((a) => `Image: ${a}`)].filter(Boolean).join("\n\n"),
          imageUrl,
        };
      },
    },
  };

  const adapter = SITES[site];

  async function permalinkOf(post) {
    let url = adapter.permalink(post);
    if (!url && adapter.revealPermalink) {
      await adapter.revealPermalink(post);
      url = adapter.permalink(post);
    }
    return url;
  }

  // ---------- Saved state ----------

  /** url -> "saved" | "saving" | "idle" */
  const states = new Map();
  const looked = new Set();
  const buttons = new Set();

  function setState(url, state, message) {
    states.set(url, state);
    for (const b of buttons) if (b.url === url) b.render(state, message);
  }

  async function lookup(url) {
    if (!url || looked.has(url)) return;
    looked.add(url);
    const res = await send({ type: "lookupPost", url });
    if (res?.saved && states.get(url) !== "saving") setState(url, "saved");
  }

  async function save(post, button) {
    const url = (button?.url ?? null) || (await permalinkOf(post));
    if (!url) {
      toast(`Couldn't find this post's link. Open the post (click its date), then save it from there.`, true);
      button?.render("error", "No link found");
      return;
    }
    if (button) button.url = url;
    if (states.get(url) === "saving") return;
    setState(url, "saving");

    let data;
    try {
      data = { url, siteName: adapter.name, ...adapter.capture(post, url) };
    } catch {
      data = { url, siteName: adapter.name };
    }
    const res = await send({ type: "savePost", data });
    if (res?.ok) {
      setState(url, "saved");
      toast("Post saved. Summarizing…");
    } else {
      setState(url, "error", res?.error);
      toast(res?.error || "Couldn't save this post.", true);
    }
  }

  // ---------- UI ----------

  const SVG = "http://www.w3.org/2000/svg";
  const MARK = "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z";
  /** [tag, attributes] per icon, built with DOM calls since some sites enforce Trusted Types. */
  const ICONS = {
    idle: [["path", { d: MARK }], ["path", { d: "M12 7v6M9 10h6" }]],
    saved: [["path", { d: MARK, fill: "currentColor" }], ["path", { d: "m9 10 2 2 4-4", stroke: "#fff" }]],
    error: [["circle", { cx: "12", cy: "12", r: "9" }], ["path", { d: "M12 8v4M12 16h.01" }]],
  };

  function icon(state) {
    if (state === "saving") return Object.assign(document.createElement("span"), { className: "spin" });
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    for (const [tag, attrs] of ICONS[state] ?? ICONS.idle) {
      const node = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      svg.append(node);
    }
    return svg;
  }

  function shadow(holder, child) {
    const root = holder.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    root.append(style, child);
    return root;
  }

  const STYLE = `
    :host { all: initial; }
    button {
      all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      cursor: pointer; font: 600 13px/1 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      transition: background 120ms, color 120ms, box-shadow 120ms;
    }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
    .spin { width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { rotate: 360deg; } }
    button:focus-visible { outline: 2px solid #2446c7; outline-offset: 2px; }

    /* X action bar: matches the native icon buttons. */
    .inline { width: 34px; height: 34px; border-radius: 999px; color: rgb(113, 118, 123); }
    .inline:hover { color: #2446c7; background: rgba(36, 70, 199, 0.1); }
    .inline.saved { color: #15803d; }
    .inline.error { color: #b42318; }

    /* Instagram / Facebook: floating pill. */
    .pill { height: 32px; padding: 0 12px 0 10px; border-radius: 999px; background: #fff; color: #1b2430;
      box-shadow: 0 1px 2px rgba(27,36,48,.12), 0 4px 14px rgba(27,36,48,.14), 0 0 0 1px rgba(27,36,48,.08); }
    .pill:hover { background: #1b2430; color: #fff; }
    .pill.saved { color: #15803d; }
    .pill.saved:hover { background: #fff; color: #15803d; cursor: default; }
    .pill.error { color: #b42318; }
    .pill svg { width: 16px; height: 16px; }

    .toast { position: fixed; left: 50%; bottom: 24px; translate: -50% 0; max-width: min(420px, calc(100vw - 32px));
      padding: 10px 14px; border-radius: 10px; background: #1b2430; color: #fff; font: 500 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
      box-shadow: 0 8px 30px rgba(0,0,0,.25); animation: rise .18s ease-out; }
    .toast.error { background: #b42318; }
    @keyframes rise { from { opacity: 0; translate: -50% 8px; } }
  `;

  function makeButton(kind, getPost) {
    const el = document.createElement("auto-bookmark-save");
    el.style.cssText = kind === "pill" ? "position:fixed;z-index:2147483646;display:none" : "display:inline-flex;align-items:center";
    const btn = document.createElement("button");
    btn.type = "button";
    shadow(el, btn);

    const api = {
      el,
      url: null,
      render(state = "idle", message) {
        btn.className = `${kind} ${state}`;
        const label =
          state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Retry" : "Save";
        btn.replaceChildren(icon(state), ...(kind === "pill" ? [Object.assign(document.createElement("span"), { textContent: label })] : []));
        const title =
          state === "saved"
            ? "Saved to Auto Bookmark"
            : state === "error"
              ? `Couldn't save${message ? `: ${message}` : ""}. Click to retry.`
              : "Save this post to Auto Bookmark";
        btn.title = title;
        btn.setAttribute("aria-label", title);
      },
    };
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const post = getPost();
      if (post && states.get(api.url) !== "saved") save(post, api);
    });
    // Keep the site from treating clicks on the button as clicks on the post.
    for (const type of ["mousedown", "mouseup", "pointerdown", "pointerup"]) {
      el.addEventListener(type, (e) => e.stopPropagation());
    }
    api.render();
    buttons.add(api);
    return api;
  }

  let toastEl;
  let toastTimer;
  function toast(message, isError = false) {
    if (!toastEl) {
      const holder = document.createElement("auto-bookmark-toast");
      holder.style.cssText = "position:fixed;z-index:2147483647";
      const box = document.createElement("div");
      box.setAttribute("role", "status");
      shadow(holder, box);
      document.documentElement.append(holder);
      toastEl = { holder, box };
    }
    toastEl.box.textContent = message;
    toastEl.box.className = `toast${isError ? " error" : ""}`;
    toastEl.holder.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.holder.style.display = "none"), isError ? 5000 : 2600);
  }

  // ---------- X: one button per post, in the action bar ----------

  function injectX() {
    for (const post of document.querySelectorAll('article[data-testid="tweet"]:not([data-abk])')) {
      const groups = post.querySelectorAll('[role="group"]');
      const bar = groups[groups.length - 1];
      if (!bar) continue;
      post.dataset.abk = "1";
      const button = makeButton("inline", () => post);
      button.url = adapter.permalink(post);
      if (button.url && states.has(button.url)) button.render(states.get(button.url));
      const slot = document.createElement("div");
      slot.style.cssText = "display:flex;align-items:center;justify-content:flex-start;flex:0 0 auto";
      slot.append(button.el);
      bar.append(slot);
    }
    // Forget buttons whose posts X has recycled out of the DOM.
    for (const b of buttons) if (b.el.isConnected === false && b !== floating) buttons.delete(b);
  }

  // ---------- Instagram / Facebook: one floating button ----------

  let floating = null;
  let current = null;
  let hideTimer;

  function place() {
    if (!current) return;
    if (!current.isConnected) return detach();
    const r = current.getBoundingClientRect();
    const { right, top, inset = 0 } = adapter.floating;
    const width = floating.el.offsetWidth || 80;
    const minY = inset + 8;
    const y = Math.min(Math.max(r.top + top, minY), r.bottom - 44);
    if (r.bottom - 44 < minY || r.top > innerHeight) {
      floating.el.style.display = "none";
      return;
    }
    floating.el.style.display = "block";
    floating.el.style.top = `${Math.round(y)}px`;
    floating.el.style.left = `${Math.round(Math.max(r.left + 8, r.right - right - width))}px`;
  }

  function attach(post) {
    current = post;
    floating.url = adapter.permalink(post);
    floating.render(states.get(floating.url) ?? "idle");
    floating.el.style.display = "block";
    place();
    lookup(floating.url);
  }

  function detach() {
    current = null;
    floating.el.style.display = "none";
  }

  function setupFloating() {
    floating = makeButton("pill", () => current);
    document.documentElement.append(floating.el);
    document.addEventListener(
      "mouseover",
      (e) => {
        if (e.target === floating.el) return clearTimeout(hideTimer);
        const post = adapter.findPost(e.target);
        if (post) {
          clearTimeout(hideTimer);
          if (post !== current) attach(post);
        } else if (current) {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(detach, 400);
        }
      },
      { passive: true },
    );
    let frame = 0;
    const schedule = () => {
      if (!current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    addEventListener("scroll", schedule, { passive: true, capture: true });
    addEventListener("resize", schedule, { passive: true });
  }

  // ---------- Wiring ----------

  if (site === "x") {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        injectX();
      });
    }).observe(document.body, { childList: true, subtree: true });
    injectX();
    // Check saved state lazily, when a post is hovered, instead of for every post in the feed.
    document.addEventListener(
      "mouseover",
      (e) => {
        const post = adapter.findPost(e.target);
        if (post) lookup(adapter.permalink(post));
      },
      { passive: true },
    );
  } else {
    setupFloating();
  }

  let contextPost = null;
  document.addEventListener("contextmenu", (e) => (contextPost = adapter.findPost(e.target)), { capture: true });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "saveContextPost") return;
    if (!contextPost) {
      sendResponse({ ok: false });
      return;
    }
    const button =
      [...buttons].find((b) => b.el.isConnected && contextPost.contains(b.el)) ??
      (contextPost === current ? floating : null);
    save(contextPost, button);
    sendResponse({ ok: true });
  });
})();
