"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { CircleAlertIcon, CircleCheckIcon, FileUpIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { importBookmarksAction, processWaitingAction } from "@/lib/actions";
import { IMPORT_CAP, IMPORT_CHUNK, parseImport, type ParsedImport } from "@/lib/import-parse";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const FORMAT_LABEL: Record<ParsedImport["format"], string> = {
  bookmarks: "bookmarks file",
  csv: "CSV export",
  text: "list of links",
};

type Totals = { added: number; existing: number; invalid: number; more: boolean };

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

export function ImportForm() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<{ name: string; parsed: ParsedImport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);

  async function read(picked: File | undefined) {
    setError(null);
    setTotals(null);
    setFile(null);
    if (!picked) return;
    if (picked.size > MAX_FILE_BYTES) {
      setError("That file is over 50 MB. Export just your bookmarks, without history or other data.");
      return;
    }
    try {
      const parsed = parseImport(await picked.text(), picked.name, (html) =>
        new DOMParser().parseFromString(html, "text/html"),
      );
      if (!parsed.items.length) {
        setError("No web links found in that file. Choose a bookmarks export (.html), a CSV with a url column, or a text file of links.");
        return;
      }
      setFile({ name: picked.name, parsed });
    } catch {
      setError("That file couldn't be read.");
    }
  }

  async function runImport() {
    if (!file) return;
    const { items } = file.parsed;
    const sum: Totals = { added: 0, existing: 0, invalid: 0, more: false };
    let budget = IMPORT_CAP;
    setError(null);
    setProgress({ sent: 0, total: items.length });
    try {
      let sent = 0;
      while (sent < items.length && budget > 0) {
        const chunk = items.slice(sent, sent + IMPORT_CHUNK);
        const r = await importBookmarksAction(chunk, budget);
        sent += chunk.length;
        budget -= r.added;
        sum.added += r.added;
        sum.existing += r.existing;
        sum.invalid += r.invalid;
        if (r.overCap > 0) sum.more = true;
        setProgress({ sent, total: items.length });
      }
      if (sent < items.length) sum.more = true;
      if (sum.added > 0) await processWaitingAction();
      setTotals(sum);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("The import stopped partway. Links added so far are kept; import the same file again to finish.");
      if (sum.added > 0) await processWaitingAction().catch(() => {});
      router.refresh();
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) read(e.dataTransfer.files[0]);
        }}
        data-dragging={dragging || undefined}
        aria-disabled={busy || undefined}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center transition-colors hover:border-ink/30 data-dragging:border-ink/40 data-dragging:bg-paper aria-disabled:pointer-events-none aria-disabled:opacity-60"
      >
        <span className="grid size-10 place-items-center rounded-full bg-paper text-ink-soft">
          <FileUpIcon className="size-5" />
        </span>
        <span className="font-medium">{file ? file.name : "Choose a file or drop it here"}</span>
        <span className="text-sm text-ink-faint">Bookmarks .html, .csv or a .txt list of links</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".html,.htm,.csv,.txt,text/html,text/csv,text/plain"
          className="sr-only"
          disabled={busy}
          onChange={(e) => read(e.target.files?.[0])}
        />
      </label>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {file ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-rule bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-ink">
              Found {plural(file.parsed.items.length, "link")} in this {FORMAT_LABEL[file.parsed.format]}
              {file.parsed.folders ? `, across ${plural(file.parsed.folders, "folder")}` : ""}.
            </p>
            <p className="mt-1 text-ink-soft">
              {file.parsed.folders ? "Folder names become tags. " : ""}
              Links you&apos;ve already saved are skipped.
              {file.parsed.items.length > IMPORT_CAP
                ? ` Each import adds up to ${IMPORT_CAP} new links, newest first; import the file again for the rest.`
                : ""}
            </p>
          </div>
          <Button onClick={runImport} disabled={busy} className="shrink-0">
            {busy ? <Spinner data-icon="inline-start" /> : <FileUpIcon data-icon="inline-start" />}
            {progress
              ? `Importing ${progress.sent.toLocaleString()} of ${progress.total.toLocaleString()}`
              : `Import ${plural(Math.min(file.parsed.items.length, IMPORT_CAP), "link")}`}
          </Button>
        </div>
      ) : null}

      {totals ? (
        <Alert>
          <CircleCheckIcon />
          <AlertTitle>
            {totals.added ? `Added ${plural(totals.added, "bookmark")}` : "Nothing new to add"}
          </AlertTitle>
          <AlertDescription>
            <p>
              {[
                totals.existing && `${plural(totals.existing, "link was", "links were")} already in your library`,
                totals.invalid && `${plural(totals.invalid, "link")} couldn't be read`,
              ]
                .filter(Boolean)
                .join(", ")}
              {totals.existing || totals.invalid ? ". " : ""}
              {totals.added
                ? "They're being summarized and filed now. That carries on if you leave this page."
                : ""}
            </p>
            {totals.more ? (
              <p>Reached the {IMPORT_CAP}-link limit for one import. Import the same file again to add the next batch.</p>
            ) : null}
            {totals.added ? (
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/library">Go to your library</Link>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
