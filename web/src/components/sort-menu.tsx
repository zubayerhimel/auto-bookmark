"use client";

import { ArrowDownUpIcon, ChevronDownIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-ink-soft" aria-label={`Sort: ${LABELS[sort]}`}>
          {pending ? <Spinner data-icon="inline-start" /> : <ArrowDownUpIcon data-icon="inline-start" />}
          {LABELS[sort]}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort} onValueChange={(value) => void setSort(value as LibrarySort)}>
          {LIBRARY_SORTS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {LABELS[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
