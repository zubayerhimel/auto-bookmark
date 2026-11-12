import {
  createLoader,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const BOOKMARK_KINDS = ["web", "tweet", "youtube"] as const;

/** The library's filters as they appear in the address bar. Shared by the server page and client controls. */
export const libraryParams = {
  category: parseAsString,
  type: parseAsStringLiteral(BOOKMARK_KINDS),
  view: parseAsStringLiteral(["unread"] as const),
  q: parseAsString.withDefault(""),
};

export const loadLibraryParams = createLoader(libraryParams);

/** Builds a library link, e.g. `libraryHref("/library", { category: "recipes" })`. */
export const libraryHref = createSerializer(libraryParams);
