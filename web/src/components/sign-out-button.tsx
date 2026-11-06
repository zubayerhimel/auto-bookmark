"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
    >
      <LogOut className="size-4" aria-hidden />
      Sign out
    </button>
  );
}
