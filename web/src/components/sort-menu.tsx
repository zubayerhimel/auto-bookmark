"use client";

import { ArrowDownUpIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { LIBRARY_SORTS, libraryParams, type LibrarySort } from "@/lib/search-params";

const LABELS: Record<LibrarySort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title A–Z",
  "title-desc": "Title Z–A",
};

/** Orders the library list. Kept in the URL as ?sort= so it survives reloads and filter changes. */
export function SortMenu() {
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useQueryState(
    "sort",
    libraryParams.sort.withOptions({ shallow: false, scroll: false, startTransition }),
  );

  return (
    <Select value={sort} onValueChange={(value) => void setSort(value as LibrarySort)}>
      <SelectTrigger
        size="sm"
        aria-label="Sort bookmarks"
        className="border-transparent bg-transparent text-ink-soft shadow-none hover:bg-muted hover:text-ink dark:bg-transparent"
      >
        {pending ? <Spinner /> : <ArrowDownUpIcon />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {LIBRARY_SORTS.map((value) => (
          <SelectItem key={value} value={value}>
            {LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
