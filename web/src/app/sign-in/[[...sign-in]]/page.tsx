import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createLoader, parseAsString, type SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { AuthPage } from "@/components/auth-page";

const loadParams = createLoader({ redirect_url: parseAsString });

/** Keeps only the path and query, so the sign-in page can't be used as an open redirect. */
function safeRedirect(value: string | null) {
  if (typeof value !== "string") return "/library";
  try {
    const url = new URL(value, "http://local");
    if (url.pathname.startsWith("/sign-in")) return "/library";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/library";
  }
}

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { userId } = await auth();
  if (userId) redirect(safeRedirect((await loadParams(searchParams)).redirect_url));

  return (
    <AuthPage>
      <Suspense>
        <SignIn />
      </Suspense>
    </AuthPage>
  );
}
