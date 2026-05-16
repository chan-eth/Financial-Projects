// Browser-side helpers that drive the WebAuthn ceremonies via
// @simplewebauthn/browser and round-trip through our same-origin
// /api/auth/* proxy routes. The Next.js routes manage all cookies and
// session bearer tokens — the browser never sees them.

import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

export interface UserSummary {
  userId: string;
  primaryAddress: string;
  displayName: string | null;
  entitlementTier: "free" | "premium" | "team";
}

export class AuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export async function registerPasskey(args: {
  primaryAddress: string;
  displayName?: string;
  deviceLabel?: string;
}): Promise<UserSummary> {
  // 1. /start — server mints ceremonyId, returns WebAuthn options.
  const startRes = await fetch("/api/auth/register/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      primaryAddress: args.primaryAddress,
      displayName: args.displayName,
    }),
  });
  if (!startRes.ok) {
    throw new AuthError(await readError(startRes), startRes.status);
  }
  const { options } = (await startRes.json()) as { options: unknown };

  // 2. Browser ceremony.
  let attestation;
  try {
    attestation = await startRegistration({
      optionsJSON: options as Parameters<typeof startRegistration>[0]["optionsJSON"],
    });
  } catch (err) {
    throw new AuthError(`passkey creation cancelled: ${String(err)}`);
  }

  // 3. /verify — server forwards attestation to the worker, mints session.
  const verifyRes = await fetch("/api/auth/register/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      response: attestation,
      deviceLabel: args.deviceLabel,
    }),
  });
  if (!verifyRes.ok) {
    throw new AuthError(await readError(verifyRes), verifyRes.status);
  }
  const { user } = (await verifyRes.json()) as { user: UserSummary };
  return user;
}

export async function loginWithPasskey(): Promise<UserSummary> {
  const startRes = await fetch("/api/auth/login/start", {
    method: "POST",
  });
  if (!startRes.ok) {
    throw new AuthError(await readError(startRes), startRes.status);
  }
  const { options } = (await startRes.json()) as { options: unknown };

  let assertion;
  try {
    assertion = await startAuthentication({
      optionsJSON: options as Parameters<typeof startAuthentication>[0]["optionsJSON"],
    });
  } catch (err) {
    throw new AuthError(`passkey login cancelled: ${String(err)}`);
  }

  const verifyRes = await fetch("/api/auth/login/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ response: assertion }),
  });
  if (!verifyRes.ok) {
    throw new AuthError(await readError(verifyRes), verifyRes.status);
  }
  const { user } = (await verifyRes.json()) as { user: UserSummary };
  return user;
}

export async function logoutPasskey(): Promise<void> {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  if (!res.ok && res.status !== 204) {
    throw new AuthError(await readError(res), res.status);
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
