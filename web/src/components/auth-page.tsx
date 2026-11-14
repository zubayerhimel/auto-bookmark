import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex items-center">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
          <LogoMark className="size-7" />
          Auto Bookmark
        </Link>
      </header>
      <div className="flex w-full flex-1 items-start justify-center py-8 sm:items-center sm:py-10 [&_.cl-rootBox]:max-w-full [&_.cl-cardBox]:max-w-full">{children}</div>
      <footer className="flex items-center justify-end">
        <ThemeToggle />
      </footer>
    </main>
  );
}
