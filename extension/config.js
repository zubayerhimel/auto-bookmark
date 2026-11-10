export const DEFAULT_API_BASE = "http://localhost:3000";

export async function getConfig() {
  const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
  return { apiBase: normalizeBase(apiBase || DEFAULT_API_BASE), token: token || null };
}

export function normalizeBase(value) {
  const url = new URL(String(value).trim());
  if (!/^https?:$/.test(url.protocol)) throw new Error("Use an http(s) address.");
  return url.origin;
}

/** Sign-in page that returns to the connect page; signed-in users skip straight to connecting. */
export function connectUrl(apiBase) {
  return `${apiBase}/sign-in?redirect_url=${encodeURIComponent("/extension?connect=1")}`;
}
