import type { Metadata } from "next";
import { createLoader, parseAsString, type SearchParams } from "nuqs/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ConnectExtension } from "@/components/connect-extension";
import { RevokeTokenButton } from "@/components/revoke-token-button";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Browser extension" };

const loadParams = createLoader({ connect: parseAsString });

export default async function ExtensionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const { connect } = await loadParams(searchParams);
  const tokens = await db
    .select()
    .from(schema.apiToken)
    .where(eq(schema.apiToken.userId, user.id))
    .orderBy(desc(schema.apiToken.createdAt));

  const code = "rounded-md bg-paper px-1.5 py-0.5 font-mono text-[0.8125rem] break-all text-ink";
  const steps = [
    {
      title: "Turn on Developer mode",
      body: (
        <>
          Open <code className={code}>chrome://extensions</code> and switch on Developer mode in the top corner.
        </>
      ),
    },
    {
      title: "Load the extension",
      body: (
        <>
          Choose Load unpacked and select the <code className={code}>extension</code> folder from this project.
        </>
      ),
    },
    { title: "Pin it", body: <>Pin Auto Bookmark to the toolbar so the save button is one click away.</> },
    { title: "Connect your account", body: <ConnectExtension autoConnect={connect === "1"} /> },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[clamp(1.75rem,3.6vw,2.25rem)] leading-tight font-bold tracking-tight">Browser extension</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        Click the toolbar button on any page, post or video and it&apos;s saved to this account, summarized and filed.
        On X, Instagram and Facebook each post gets its own save button, and right-clicking a link saves it without
        opening it.
      </p>

      <section aria-labelledby="install" className="mt-10 rounded-2xl border border-rule bg-card p-5 sm:p-8">
        <h2 id="install" className="text-lg font-bold tracking-tight">
          Install it in Chrome, Edge, Brave or Arc
        </h2>
        <ol className="mt-6 flex flex-col">
          {steps.map((step, i) => (
            <li key={step.title} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 pb-7 last:pb-0">
              {i < steps.length - 1 ? (
                <span aria-hidden className="absolute top-8 bottom-1 left-[0.8125rem] w-px bg-rule" />
              ) : null}
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-full border border-ink/15 bg-paper text-[0.8125rem] font-semibold tabular-nums"
              >
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="font-semibold">{step.title}</h3>
                <div className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-soft">{step.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="browsers" className="mt-12">
        <h2 id="browsers" className="text-lg font-bold tracking-tight">
          Connected browsers
        </h2>
        {tokens.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-rule bg-card px-5 py-6 text-sm text-ink-faint">
            No browsers yet. Connect the extension above and it shows up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="mt-0.5 text-sm text-ink-faint">
                    Connected {timeAgo(t.createdAt)}
                    {t.lastUsedAt ? `, last saved ${timeAgo(t.lastUsedAt)}` : ", not used yet"}
                  </p>
                </div>
                <RevokeTokenButton id={t.id} name={t.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
