"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutPasskey, AuthError } from "@/lib/authClient";

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setSubmitting(true);
    try {
      await logoutPasskey();
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={submitting}
        className="self-start rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
      >
        {submitting ? "Signing out…" : "Sign out"}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
