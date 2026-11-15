import type { Metadata } from "next";
import { AiKeyForm, NoKeyNotice, RemoveAiKeyButton } from "@/components/ai-key-form";
import { Badge } from "@/components/ui/badge";
import { PROVIDERS } from "@/lib/ai-providers";
import { getAiSettings } from "@/lib/ai-settings";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "AI settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const saved = await getAiSettings(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-semibold tracking-tight">AI settings</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        Auto Bookmark uses your own AI key to summarize, tag and file what you save, and to answer questions about your
        library. Your provider bills its usage to your account; summarizing a bookmark typically costs a fraction of a
        cent.
      </p>

      <section aria-labelledby="current-key" className="mt-10">
        <h2 id="current-key" className="text-lg font-semibold tracking-tight">
          Your key
        </h2>
        <div className="mt-3">
          {saved ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-rule bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {PROVIDERS[saved.provider].label}
                  <Badge variant="secondary" className="font-mono">
                    ••••{saved.keyHint}
                  </Badge>
                </p>
                <p className="mt-0.5 truncate text-sm text-ink-faint">
                  {saved.model ?? PROVIDERS[saved.provider].defaultModel}, saved {timeAgo(saved.updatedAt)}
                </p>
              </div>
              <RemoveAiKeyButton />
            </div>
          ) : (
            <NoKeyNotice />
          )}
        </div>
      </section>

      <section aria-labelledby="set-key" className="mt-12 rounded-2xl border border-rule bg-card p-5 sm:p-8">
        <h2 id="set-key" className="text-lg font-semibold tracking-tight">
          {saved ? "Change provider, key or model" : "Add a key"}
        </h2>
        <p className="mt-1 mb-6 max-w-[60ch] text-sm text-ink-soft">
          The key is checked with one tiny request, then stored encrypted and used only for your bookmarks. It&apos;s
          never shown again, not even to you.
        </p>
        <AiKeyForm saved={saved ? { provider: saved.provider, keyHint: saved.keyHint, model: saved.model } : null} />
      </section>
    </div>
  );
}
