import { getConfig, normalizeBase } from "./config.js";

const form = document.getElementById("form");
const apiBaseInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("token");
const status = document.getElementById("status");
const state = document.getElementById("state");

async function render() {
  const { apiBase, token } = await getConfig();
  apiBaseInput.value = apiBase;
  if (!token) {
    state.textContent = "Not connected to an account yet.";
    return;
  }
  try {
    const res = await fetch(`${apiBase}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
    const me = res.ok ? await res.json() : null;
    state.textContent = me ? `Connected as ${me.email}.` : "The saved key no longer works. Connect again.";
  } catch {
    state.textContent = `Couldn't reach ${apiBase}.`;
  }
}

function show(message, isError = false) {
  status.textContent = message;
  status.className = isError ? "error" : "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const apiBase = normalizeBase(apiBaseInput.value);
    const previous = await getConfig();
    const update = { apiBase };
    const token = tokenInput.value.trim();
    if (token) {
      if (!token.startsWith("abk_")) throw new Error("Access keys start with abk_.");
      update.token = token;
    } else if (previous.apiBase !== apiBase) {
      await chrome.storage.local.remove("token");
    }
    await chrome.storage.local.set(update);
    tokenInput.value = "";
    show("Saved.");
    render();
  } catch (err) {
    show(err.message || "Check the address.", true);
  }
});

document.getElementById("connect").addEventListener("click", async () => {
  try {
    const apiBase = normalizeBase(apiBaseInput.value);
    await chrome.storage.local.set({ apiBase });
    chrome.tabs.create({ url: `${apiBase}/extension?connect=1` });
  } catch (err) {
    show(err.message || "Check the address.", true);
  }
});

render();
