import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ConnectExtension } from "@/components/connect-extension";
import { RevokeTokenButton } from "@/components/revoke-token-button";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";

export default async function ExtensionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { connect } = await searchParams;
  const tokens = await db
    .select()
    .from(schema.apiToken)
    .where(eq(schema.apiToken.userId, user.id))
    .orderBy(desc(schema.apiToken.createdAt));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[clamp(1.6rem,3.5vw,var(--text-3xl))] font-bold tracking-tight">Browser extension</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        The extension adds one button to your toolbar. Click it on any web page, post on X, or YouTube
        video and it&apos;s saved to this account, summarized and filed. Right-click a link to save
        it without opening it.
      </p>

      <section className="mt-8">
        <h2 className="font-semibold">Install it in Chrome, Edge, Brave or Arc</h2>
        <ol className="mt-3 max-w-[60ch] list-decimal space-y-1.5 pl-5 text-ink-soft marker:font-semibold marker:text-ink">
          <li>
            Open <code className="rounded bg-paper px-1.5 py-0.5 text-sm">chrome://extensions</code> and turn on{" "}
            <strong className="text-ink">Developer mode</strong>.
          </li>
          <li>
            Choose <strong className="text-ink">Load unpacked</strong> and select the{" "}
            <code className="rounded bg-paper px-1.5 py-0.5 text-sm">extension</code> folder from this project.
          </li>
          <li>Pin Auto Bookmark to the toolbar, then reload this page.</li>
          <li>Connect it to your account:</li>
        </ol>
        <div className="mt-5">
          <ConnectExtension autoConnect={connect === "1"} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-semibold">Connected browsers</h2>
        {tokens.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-ink-faint">
                    Connected {timeAgo(t.createdAt)}
                    {t.lastUsedAt ? `, last saved ${timeAgo(t.lastUsedAt)}` : ", not used yet"}
                  </p>
                </div>
                <RevokeTokenButton id={t.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
