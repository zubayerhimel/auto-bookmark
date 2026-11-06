// Injected into the web app's /extension page so the page can hand this extension an access key.
(() => {
  if (window.__autoBookmarkConnect) return;
  window.__autoBookmarkConnect = true;
  document.documentElement.dataset.autoBookmarkExtension = "1";
  window.postMessage({ source: "auto-bookmark-extension", type: "ready" }, location.origin);

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (data?.source !== "auto-bookmark-app" || data.type !== "connect") return;
    chrome.runtime.sendMessage({ type: "connect", token: data.token }, (response) => {
      if (response?.ok) {
        window.postMessage({ source: "auto-bookmark-extension", type: "connected" }, location.origin);
      }
    });
  });
})();
