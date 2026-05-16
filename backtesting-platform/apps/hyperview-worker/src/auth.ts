// HyperView worker auth fence.
//
// Three scopes reachable today:
//
//   - public:        no auth required. Market data reads, health probe,
//                    passkey register/login ceremony start+verify.
//   - user:          session-bound. Validates `Authorization: Bearer <jwt>`
//                    signed with SESSION_SIGNING_SECRET. Sets userId on ctx.
//   - internal:      server-to-server, constant-time check against
//                    WORKER_INTERNAL_SECRET.
//
// The trading scope (`user.trading`) and operator scope land later — see
// PLAN §7. Until then, requireAuth() throws UnauthorizedError for them.

import { UnauthorizedError } from "./errors.js";
import { verifySession } from "./services/session.js";

export type AuthScope = "public" | "user" | "user.trading" | "operator" | "internal";

export interface AuthContext {
  scope: AuthScope;
  userId?: string;
  primaryAddress?: string;
}

export async function requireAuth(
  request: Request,
  scope: AuthScope,
  env: {
    WORKER_INTERNAL_SECRET?: string;
    SESSION_SIGNING_SECRET?: string;
  },
): Promise<AuthContext> {
  if (scope === "public") {
    return { scope: "public" };
  }

  if (scope === "internal") {
    const provided = request.headers.get("x-internal-secret");
    if (
      !env.WORKER_INTERNAL_SECRET ||
      !provided ||
      !constantTimeEquals(provided, env.WORKER_INTERNAL_SECRET)
    ) {
      throw new UnauthorizedError("missing or invalid internal secret");
    }
    return { scope: "internal" };
  }

  if (scope === "user") {
    const signingSecret = env.SESSION_SIGNING_SECRET;
    if (!signingSecret) {
      throw new UnauthorizedError("session signing secret not configured");
    }
    const auth = request.headers.get("authorization") ?? "";
    const match = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(auth);
    const token = match?.[1];
    if (!token) throw new UnauthorizedError("missing bearer token");
    try {
      const payload = await verifySession(token, signingSecret);
      return { scope: "user", userId: payload.uid };
    } catch (err) {
      throw new UnauthorizedError(`invalid session: ${String(err)}`);
    }
  }

  // user.trading / operator land in M5 + admin work respectively.
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
