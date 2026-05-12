import type { Env } from "./env.js";
import { UnauthorizedError } from "./errors.js";

export interface AuthContext {
  /** Operator email from Cloudflare Access, if present. */
  readonly email: string | null;
  /** True when this request authenticated via the Vercel server-to-server path. */
  readonly viaInternalSecret: boolean;
}

/**
 * Resolves the caller. Two parallel paths:
 *
 * 1. Cloudflare Access — `Cf-Access-Authenticated-User-Email` is set by Access
 *    after the user goes through the identity provider. The Worker
 *    additionally checks the email is in OPERATOR_EMAILS so a misconfigured
 *    Access policy can't grant access to unintended identities.
 * 2. Internal secret — used by the Vercel server-side proxy. Browser never
 *    sees this value.
 *
 * Throws UnauthorizedError if neither path is satisfied.
 */
export function requireAuth(req: Request, env: Env): AuthContext {
  const email = req.headers.get("cf-access-authenticated-user-email");
  if (email != null) {
    const allowed = (env.OPERATOR_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length === 0 || allowed.includes(email.toLowerCase())) {
      return { email: email.toLowerCase(), viaInternalSecret: false };
    }
  }

  const presented = req.headers.get("x-internal-secret");
  if (env.WORKER_INTERNAL_SECRET == null) {
    // Local dev only: no secret configured, no Access in front. Open.
    return { email: null, viaInternalSecret: true };
  }
  if (presented != null && timingSafeEqual(presented, env.WORKER_INTERNAL_SECRET)) {
    return { email: null, viaInternalSecret: true };
  }

  throw new UnauthorizedError();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
