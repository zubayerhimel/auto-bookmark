import { FileText, MessageSquareText, MonitorPlay } from "lucide-react";
import type { BookmarkType } from "@/db/schema";

export function TypeIcon({ type, className = "size-3.5" }: { type: BookmarkType; className?: string }) {
  const Icon = type === "youtube" ? MonitorPlay : type === "tweet" ? MessageSquareText : FileText;
  return <Icon className={className} aria-hidden />;
}
