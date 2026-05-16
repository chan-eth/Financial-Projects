"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithPasskey, AuthError } from "@/lib/authClient";

export function PasskeyLoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithPasskey();
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-md w-full">
      <button
        type="button"
        onClick={onClick}
        disabled={submitting}
        className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
      >
        {submitting ? "Authenticating…" : "Sign in with passkey"}
      </button>
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
      <p className="text-xs text-neutral-500">
        Your browser will prompt you to pick the passkey you registered with
        HyperView. Discoverable credentials only — no email or username needed.
      </p>
    </div>
  );
}
