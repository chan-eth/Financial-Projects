"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerPasskey, AuthError } from "@/lib/authClient";

export function PasskeyRegisterForm() {
  const router = useRouter();
  const [primaryAddress, setPrimaryAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerPasskey({
        primaryAddress: primaryAddress.trim(),
        displayName: displayName.trim() || undefined,
        deviceLabel: deviceLabel.trim() || undefined,
      });
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-md w-full">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-300">Primary on-chain address</span>
        <input
          type="text"
          required
          spellCheck={false}
          autoComplete="off"
          placeholder="0x…"
          pattern="^0x[a-fA-F0-9]{40}$"
          value={primaryAddress}
          onChange={(e) => setPrimaryAddress(e.target.value)}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm focus:border-neutral-600 focus:outline-none"
        />
        <span className="text-xs text-neutral-500">
          Your Hyperliquid address. Bound to this passkey forever.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-300">Display name (optional)</span>
        <input
          type="text"
          maxLength={60}
          placeholder="e.g. Casey"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-300">Device label (optional)</span>
        <input
          type="text"
          maxLength={60}
          placeholder="e.g. MacBook Air 2025"
          value={deviceLabel}
          onChange={(e) => setDeviceLabel(e.target.value)}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
        />
      </label>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
      >
        {submitting ? "Creating passkey…" : "Create passkey"}
      </button>
    </form>
  );
}
