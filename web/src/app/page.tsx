import { redirect } from "next/navigation";
import { Landing } from "@/components/landing";
import { getUserId } from "@/lib/session";

function safeNext(value: string | string[] | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/library";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getUserId()) redirect(next);

  return <Landing next={next} />;
}
