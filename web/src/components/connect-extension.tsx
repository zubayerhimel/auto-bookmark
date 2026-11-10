"use client";

import { CheckIcon, CircleCheckIcon, CopyIcon, PlugIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
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
  const [origin, setOrigin] = useState("");
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
      setOrigin(window.location.origin);
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
      <Alert>
        <CircleCheckIcon />
        <AlertTitle>Connected</AlertTitle>
        <AlertDescription>Click the Auto Bookmark button on any page to save it.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={connect} disabled={pending || phase === "connecting"}>
          {phase === "connecting" ? <Spinner data-icon="inline-start" /> : <PlugIcon data-icon="inline-start" />}
          {phase === "connecting" ? "Connecting" : "Connect extension"}
        </Button>
        <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
          <span aria-hidden className={`size-2 rounded-full ${detected ? "bg-[#1f8a4c]" : "border border-ink-faint"}`} />
          {detected ? "Extension found in this browser" : "Extension not found in this browser yet"}
        </span>
      </div>
      {phase === "manual" && token ? (
        <Card className="bg-paper/60 shadow-none">
          <CardHeader>
            <CardTitle>Paste this key into the extension</CardTitle>
            <CardDescription>
              The extension didn&apos;t answer. Open its options (right-click the toolbar button, then Options) and
              paste this key, with <strong className="break-all text-foreground">{origin}</strong> as the app address.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InputGroup>
              <InputGroupInput readOnly value={token} aria-label="Extension key" className="font-mono text-xs md:text-xs" onFocus={(e) => e.currentTarget.select()} />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(token);
                    setCopied(true);
                    toast.success("Key copied.");
                  }}
                >
                  {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
                  {copied ? "Copied" : "Copy"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">This key is shown once. Revoke it below if it leaks.</p>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
