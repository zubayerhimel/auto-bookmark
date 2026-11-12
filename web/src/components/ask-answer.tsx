"use client";

import Link from "next/link";
import { CircleAlertIcon } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RowRibbon } from "./row-ribbon";
import { TypeIcon } from "./type-icon";

type Source = {
  n: number;
  id: string;
  url: string;
  type: "web" | "tweet" | "youtube";
  title: string;
  site: string;
  categoryName: string | null;
  categoryColor: string | null;
};

type State = {
  sources: Source[] | null;
  text: string;
  done: boolean;
  error: string | null;
};

const CITATION = /\[(\d{1,2})\]/g;

function useAnswer(question: string) {
  const [state, setState] = useState<State>({ sources: null, text: "", done: false, error: null });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "The answer couldn't be written. Try asking again.");
        }
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            const msg = JSON.parse(line);
            setState((s) => {
              if (msg.type === "sources") return { ...s, sources: msg.sources };
              if (msg.type === "text") return { ...s, text: s.text + msg.text };
              if (msg.type === "error") return { ...s, error: msg.message, done: true };
              if (msg.type === "done") return { ...s, done: true };
              return s;
            });
          }
        }
        setState((s) => ({ ...s, done: true }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({ ...s, error: (err as Error).message, done: true }));
      }
    })();
    return () => controller.abort();
  }, [question]);

  return state;
}

/** Turns "[2]" into a link to that bookmark; numbers that don't match a source are dropped. */
function withCitations(text: string, byN: Map<number, Source>) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(CITATION)) {
    const source = byN.get(Number(m[1]));
    out.push(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (!source) continue;
    out.push(
      <Link
        key={m.index}
        href={`/library/${source.id}`}
        title={source.title}
        className="mx-px inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-px items-center justify-center rounded-[5px] bg-action/10 px-1 align-middle font-sans text-[0.7rem] font-semibold text-action tabular-nums transition-colors duration-150 ease-out hover:bg-action hover:text-action-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="sr-only">Source </span>
        {source.n}
      </Link>,
    );
  }
  out.push(text.slice(last));
  return out;
}

function AnswerBody({ text, byN }: { text: string; byN: Map<number, Source> }) {
  const blocks = text
    .replace(/\*\*/g, "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="flex max-w-[65ch] flex-col gap-3 text-base leading-[1.7] text-pretty sm:text-[1.0625rem]">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s/.test(l))) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-ink-faint">
              {lines.map((l, j) => (
                <li key={j}>{withCitations(l.replace(/^\s*[-*•]\s/, ""), byN)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 ? " " : null}
                {withCitations(l, byN)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** An answer to a question, written from the bookmarks search found, with links to the ones it used. */
export function AskAnswer({ question }: { question: string }) {
  const { sources, text, done, error } = useAnswer(question);
  const byN = new Map((sources ?? []).map((s) => [s.n, s]));
  const cited = new Set([...text.matchAll(CITATION)].map((m) => Number(m[1])));
  const used = (sources ?? []).filter((s) => cited.has(s.n));
  const writing = !done && !error;

  return (
    <section
      aria-labelledby="ask-heading"
      aria-busy={writing}
      className="relative mt-4 rounded-2xl border border-rule bg-card py-5 pr-5 pl-10 sm:py-6 sm:pr-7 sm:pl-12"
    >
      <span aria-hidden className="pointer-events-none absolute -top-px left-4 h-12 w-2.5 sm:left-5">
        <RowRibbon busy={writing} color="var(--action)" className="h-full w-full" />
      </span>
      <h2 id="ask-heading" className="text-xs font-semibold text-action">
        {error
          ? "Answer from your library"
          : sources === null
            ? "Looking through your bookmarks…"
            : sources.length === 0
              ? "Answer from your library"
              : writing
                ? `Reading ${sources.length === 1 ? "one bookmark" : `${sources.length} bookmarks`}…`
                : "Answer from your library"}
      </h2>

      <div className="mt-2" aria-live="polite">
        {error ? (
          <Alert variant="destructive" className="mt-2">
            <CircleAlertIcon />
            <AlertTitle>No answer this time</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : sources !== null && sources.length === 0 ? (
          <p className="text-base leading-[1.7] text-ink-soft sm:text-[1.0625rem]">
            Nothing you&apos;ve saved covers that yet. Save a page about it and ask again.
          </p>
        ) : text ? (
          <AnswerBody text={text} byN={byN} />
        ) : (
          <div className="flex max-w-[65ch] flex-col gap-2.5 pt-1.5" aria-label="Writing the answer">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </div>

      {done && used.length ? (
        <div className="mt-5 border-t border-rule pt-4">
          <h3 className="text-xs font-semibold text-ink-soft">From these bookmarks</h3>
          <ol className="mt-2 flex flex-col gap-1">
            {used.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/library/${s.id}`}
                  className="group/src -mx-2 flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="w-4 shrink-0 text-right text-xs font-semibold text-action tabular-nums">{s.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium group-hover/src:text-action">{s.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                      <TypeIcon type={s.type} />
                      <span className="truncate">{s.site}</span>
                      {s.categoryName ? (
                        <>
                          <span
                            aria-hidden
                            className="ml-1.5 size-1.5 shrink-0 rounded-full"
                            style={{ background: s.categoryColor ?? "var(--rule)" }}
                          />
                          <span className="truncate">{s.categoryName}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
