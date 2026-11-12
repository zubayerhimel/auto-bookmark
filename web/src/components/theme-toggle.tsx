"use client";

import { useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MODES = [
  { value: "system", label: "System", Icon: MonitorIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "light", label: "Light", Icon: SunIcon },
] as const;

const noopSubscribe = () => () => {};

/** One button that cycles the theme: system, then dark, then light. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser; render no icon until then so the server's guess never flashes.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const index = Math.max(0, MODES.findIndex((mode) => mode.value === theme));
  const current = MODES[index];
  const next = MODES[(index + 1) % MODES.length];
  const label = `Theme: ${current.label}. Switch to ${next.label.toLowerCase()}.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={className}
          aria-label={mounted ? label : "Theme"}
          onClick={() => setTheme(next.value)}
        >
          {mounted ? (
            <current.Icon key={current.value} className="animate-in duration-200 ease-out fade-in zoom-in-75" />
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{mounted ? `Theme: ${current.label}` : "Theme"}</TooltipContent>
    </Tooltip>
  );
}
