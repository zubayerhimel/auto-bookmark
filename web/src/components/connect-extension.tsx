"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createExtensionTokenAction } from "@/lib/actions";

type Phase = "idle" | "connecting" | "connected" | "manual";

function browserName() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Brave/.test(ua)) return "Brave";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  return "Browser";
}

export function ConnectExtension({ autoConnect }: { autoConnect: boolean }) {
  const [detected, setDetected] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const autoTried = useRef(false);

  useEffect(() => {
    const check = () => setDetected(document.documentElement.dataset.autoBookmarkExtension === "1");
    check();
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.data?.source !== "auto-bookmark-extension") return;
      if (e.data.type === "ready") setDetected(true);
      if (e.data.type === "connected") setPhase("connected");
    };
    window.addEventListener("message", onMessage);
    const t = setTimeout(check, 500);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, []);

  const connect = useCallback(() => {
    start(async () => {
      setPhase("connecting");
      const newToken = await createExtensionTokenAction(`${browserName()} extension`);
      setToken(newToken);
      window.postMessage(
        { source: "auto-bookmark-app", type: "connect", token: newToken, apiBase: window.location.origin },
        window.location.origin,
      );
      setTimeout(() => setPhase((p) => (p === "connected" ? p : "manual")), 2000);
    });
  }, []);

  useEffect(() => {
    if (autoConnect && detected && !autoTried.current) {
      autoTried.current = true;
      connect();
    }
  }, [autoConnect, detected, connect]);

  if (phase === "connected") {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-[#15803D]/10 px-4 py-3 font-medium text-[#15803D]">
        <Check className="size-5" aria-hidden />
        Connected. Click the Auto Bookmark button on any page to save it.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={connect}
          disabled={pending || phase === "connecting"}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-action disabled:opacity-60"
        >
          {phase === "connecting" ? "Connecting…" : "Connect extension"}
        </button>
        <span className="text-sm text-ink-faint">
          {detected ? "Extension found in this browser." : "Extension not found in this browser yet."}
        </span>
      </div>
      {phase === "manual" && token ? (
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-sm">
            The extension didn&apos;t answer. Open its options (right-click the toolbar button, then
            Options) and paste this key along with <strong>{typeof window !== "undefined" ? window.location.origin : ""}</strong> as the app address.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-paper px-3 py-2 text-xs">{token}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(token);
                setCopied(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-2 text-sm hover:border-ink"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-faint">This key is shown once. Revoke it below if it leaks.</p>
        </div>
      ) : null}
    </div>
  );
}
