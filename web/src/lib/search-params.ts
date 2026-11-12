import {
  createLoader,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const BOOKMARK_KINDS = ["web", "tweet", "youtube"] as const;

export const LIBRARY_SORTS = ["newest", "oldest", "title", "title-desc"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

/** The library's filters as they appear in the address bar. Shared by the server page and client controls. */
export const libraryParams = {
  category: parseAsString,
  type: parseAsStringLiteral(BOOKMARK_KINDS),
  view: parseAsStringLiteral(["unread"] as const),
  sort: parseAsStringLiteral(LIBRARY_SORTS).withDefault("newest"),
  q: parseAsString.withDefault(""),
};

export const loadLibraryParams = createLoader(libraryParams);

/** Builds a library link, e.g. `libraryHref("/library", { category: "recipes" })`. */
export const libraryHref = createSerializer(libraryParams);
