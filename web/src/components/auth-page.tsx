import Link from "next/link";

export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-8 sm:px-8">
      <header>
        <Link href="/" className="text-lg font-bold tracking-tight">
          Auto Bookmark
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center py-10">{children}</div>
    </main>
  );
}
