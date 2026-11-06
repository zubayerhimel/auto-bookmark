"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton({ className = "", callbackURL = "/library" }: { className?: string; callbackURL?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signIn.social({ provider: "google", callbackURL });
      }}
      className={`inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-action disabled:opacity-70 ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5">
        <path fill="#fff" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.97-4.32 2.97-7.35Z" />
        <path fill="#fff" opacity=".85" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.07v2.58A10 10 0 0 0 12 22Z" />
        <path fill="#fff" opacity=".7" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.5H3.07a10 10 0 0 0 0 9l3.34-2.58Z" />
        <path fill="#fff" opacity=".55" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.58C7.2 7.72 9.4 5.97 12 5.97Z" />
      </svg>
      {pending ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}
