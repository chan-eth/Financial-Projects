// Server-side helpers for proxying to the hyperview-worker and reading
// the session cookie for server-rendered pages.
//
// All worker calls go through here so:
//   - the upstream URL lives in one place,
//   - the internal secret is attached uniformly (when configured),
//   - session bearer tokens come from the cookie automatically.

import { cookies } from "next/headers";
import { HV_SESSION_COOKIE } from "./cookies";

const HYPERVIEW_API = process.env.HYPERVIEW_API ?? null;
const HYPERVIEW_INTERNAL_SECRET = process.env.HYPERVIEW_INTERNAL_SECRET ?? null;

export interface UserSummary {
  userId: string;
  primaryAddress: string;
  displayName: string | null;
  entitlementTier: "free" | "premium" | "team";
}

export interface PasskeySummary {
  credentialId: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface MeResponse {
  user: UserSummary;
  passkeys: PasskeySummary[];
}

function requireApiBase(): string {
  if (!HYPERVIEW_API) {
    throw new Error(
      "HYPERVIEW_API not configured — passkey auth requires the worker " +
      "to be reachable. Set HYPERVIEW_API to the worker origin.",
    );
  }
  return HYPERVIEW_API;
}

function baseHeaders(extra: HeadersInit = {}): Headers {
  const h = new Headers(extra);
  h.set("content-type", "application/json");
  h.set("accept", "application/json");
  if (HYPERVIEW_INTERNAL_SECRET) {
    h.set("x-internal-secret", HYPERVIEW_INTERNAL_SECRET);
  }
  return h;
}

export async function workerPost(
  pathname: string,
  body: unknown,
  opts: { sessionToken?: string } = {},
): Promise<Response> {
  const headers = baseHeaders();
  if (opts.sessionToken) {
    headers.set("authorization", `Bearer ${opts.sessionToken}`);
  }
  return fetch(`${requireApiBase()}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
}

export async function workerGet(
  pathname: string,
  opts: { sessionToken?: string } = {},
): Promise<Response> {
  const headers = baseHeaders();
  if (opts.sessionToken) {
    headers.set("authorization", `Bearer ${opts.sessionToken}`);
  }
  return fetch(`${requireApiBase()}${pathname}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
}

/** Read the JWT session token from the hv_session cookie. Returns null if absent. */
export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(HV_SESSION_COOKIE)?.value ?? null;
}

/** Server-component-friendly: fetch the current user, or null if not signed in. */
export async function getCurrentUser(): Promise<MeResponse | null> {
  const token = await readSessionToken();
  if (!token) return null;
  try {
    const res = await workerGet("/auth/me", { sessionToken: token });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}
