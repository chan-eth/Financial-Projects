// HyperView worker auth fence.
//
// Modeled on backtesting-platform/apps/worker/src/auth.ts but extended for end-user
// requests. Three scopes are reachable at M0:
//
//   - public:        no auth required. Market data reads, health probe.
//   - operator:      placeholder — wired in M0b alongside the admin surface.
//   - internal:      server-to-server, constant-time check against WORKER_INTERNAL_SECRET.
//
// The remaining two scopes (user, user.trading) require passkey-attested sessions
// and land in M0b (passkey auth e2e) and M5 (trading scope) respectively. Until
// then, requireAuth() throws UnauthorizedError for them.

import { UnauthorizedError } from "./errors.js";

export type AuthScope = "public" | "user" | "user.trading" | "operator" | "internal";

export interface AuthContext {
  scope: AuthScope;
  userId?: string;
  primaryAddress?: string;
}

export async function requireAuth(
  request: Request,
  scope: AuthScope,
  internalSecret?: string,
): Promise<AuthContext> {
  if (scope === "public") {
    return { scope: "public" };
  }

  if (scope === "internal") {
    const provided = request.headers.get("x-internal-secret");
    if (!internalSecret || !provided || !constantTimeEquals(provided, internalSecret)) {
      throw new UnauthorizedError("missing or invalid internal secret");
    }
    return { scope: "internal" };
  }

  // user / user.trading / operator land in M0b and M5.
  throw new UnauthorizedError(`auth scope ${scope} not implemented yet`);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
