# @hv/trading

Hyperliquid order signing and sub-account orchestration. Used by:

- `hyperview-web/` — browser-side signing of orders against a passkey-derived secp256k1 key.
- `apps/hyperview-worker/` — server-side **validation** and forwarding of signed payloads. The worker never holds private keys.
- `apps/hyperview-worker/` (read paths) — typed fills + position reconciliation.

Native iOS and Android **do not depend on this package**. They reimplement order signing locally in Swift/Kotlin so private keys never traverse a JS runtime. This package is the canonical reference implementation; the native ports are kept behavior-compatible via shared test vectors in `tests/vectors/`.

## Status

**M0 scaffolding** — placeholder index. First real signing + submit lands in M5 (trading-everywhere milestone). M0–M4 use this package only for typed read-side helpers (parsing fills, position queries).

## Sub-account abstraction

UI calls them "Strategies." A sub-account is created lazily on the user's first trade after toggling the feature on. Default UX routes all trades to the user's main address; sub-accounts are an opt-in power-user feature behind a disclosure modal explaining margin isolation tradeoffs. See `hyperview/PLAN.md` §5.

## Security boundary

- Private keys never enter the worker process; the worker only ever sees signed payloads.
- Every order request carries an `Idempotency-Key`; the worker deduplicates retries by SHA-256 of the canonicalized payload (same pattern as the backtester's `POST /runs`).
- The trading scope (`user.trading`) requires a fresh device-attestation token (App Attest / Play Integrity) within the last 5 minutes — enforced by `apps/hyperview-worker/src/auth.ts`.
