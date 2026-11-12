import { redirect } from "next/navigation";
import { createLoader, parseAsString, type SearchParams } from "nuqs/server";
import { Landing } from "@/components/landing";
import { getUserId } from "@/lib/session";

const loadParams = createLoader({ next: parseAsString });

function safeNext(value: string | null) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/library";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const next = safeNext((await loadParams(searchParams)).next);
  if (await getUserId()) redirect(next);

  return <Landing next={next} />;
}
