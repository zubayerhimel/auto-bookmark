"use client";

import { useTransition } from "react";
import { revokeExtensionTokenAction } from "@/lib/actions";

export function RevokeTokenButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => revokeExtensionTokenAction(id))}
      className="text-sm text-danger hover:underline disabled:opacity-60"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
