// HyperView worker auth fence — M0 stub.
//
// Modeled on backtesting-platform/apps/worker/src/auth.ts but extended for end-user
// requests. The existing fence only knows operator-email and internal-secret paths.
// HyperView adds:
//   1. Passkey-attested user sessions (P-256, WebAuthn) — set by /auth/passkey/verify.
//   2. Distinct trading scope: POST /orders and POST /subaccount require a fresh
//      device-attestation token (App Attest / Play Integrity) within the last 5 min.
//
// Implementation lands in M0 (passkey path) and M5 (trading scope). This file currently
// declares the public surface only so callers can be wired before logic is filled in.

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export type AuthScope = "public" | "user" | "user.trading" | "operator" | "internal";

export interface AuthContext {
  scope: AuthScope;
  userId?: string;
  primaryAddress?: string;
}

export async function requireAuth(
  _request: Request,
  _scope: AuthScope,
): Promise<AuthContext> {
  throw new UnauthorizedError("auth fence not implemented in M0 scaffold");
}
