# HyperView security model — delta vs. backtesting-platform

This is a *delta* document. It extends the model in `backtesting-platform/README.md` ("Security model" section) and the policy in `/SECURITY.md`. It does not replace either.

## In scope (when code lands)

- `backtesting-platform/apps/hyperview-worker/` — separate Cloudflare Worker for HyperView (market data, alerts, trading proxy, scriptshop API).
- `backtesting-platform/packages/{hypescript,hv-schemas,hv-charts,hv-trading}/`
- `hyperview-web/`, `hyperview-ios/`, `hyperview-android/`
- Future deployed services: `hyperview.xyz`, `api.hyperview.xyz`, `play.hyperview.xyz`, `hypescript.dev`.

## What carries over unchanged from the existing model

- Worker auth fence — Cloudflare Access (operator path) + constant-time internal-secret check (server-to-server path).
- Zod input validation at every external boundary; prepared SQL statements; no interpolation of user input.
- Origin allowlist on the Vercel server-side proxy. Method/size/timeout caps.
- Cloudflare native rate limiting (per-IP global + per-endpoint).
- Idempotency-key dedup on non-idempotent writes.
- Husky pre-commit secret scan.

## Additions

### Mobile clients

- Certificate pinning to `api.hyperview.xyz` and `api.hyperliquid.xyz`. Two pins each (current + backup). Rotation runbook documented before public launch.
- iOS App Attest + DeviceCheck on `POST /orders`. Android Play Integrity API on the same.
- Jailbreak/root detection — refuses to load the local signing key if detected. Friction, not security.
- Screenshot/screen-record block on order entry and seed-display screens.
- Local secp256k1 trading key is generated in user space, wrapped with a hardware-held key (Secure Enclave on iOS, Keystore/StrongBox on Android), and stored in Keychain/EncryptedSharedPreferences with biometric gating on every signature. **The Secure Enclave does not natively generate secp256k1 — be explicit with users that the key is hardware-*gated*, not hardware-*generated*.**
- Passkey (P-256) handles account login and server auth. Separate from the secp256k1 trading key — distinct in UI and code.

### Backend additions

- Per-user token-bucket rate limits keyed in Workers KV, on top of the existing per-IP limits.
- Trading endpoints (`POST /orders`, sub-account creation) require a distinct auth scope and a fresh device-attestation token.
- Anomaly detection: sliding-window order-rate check. A user >10× their 30-day p99 rate is soft-blocked pending re-auth.
- Audit log shipped off D1 within 5 minutes to R2 cold storage; 7-day hot window remains in D1 for live debugging. Closes a gap noted in `backtesting-platform/README.md`.
- Quarterly secret rotation runbook covering `WORKER_INTERNAL_SECRET`, AdMob, Stripe, RevenueCat.

### HypeScript runtime

- Resource limits enforced inside the VM (gas counter on bytecode ops, heap caps, no syscalls). Compiler limits are advisory; VM limits are the security boundary.
- Scriptshop supply chain: manifest validation, passkey signature on publish, denylist static check, "unverified" badge by default, manual review gate for the "verified" badge.
- Per-script telemetry; auto-quarantine on crash / OOM / time-budget burn.

### Regulatory / geo posture

Allowlist, not denylist. At launch: EU + select APAC + LATAM open. Geo-blocked: US (pending counsel sign-off on a wallet-tool carve-out or state-by-state MTL strategy), UK (FCA promotion rules for crypto), OFAC list, mainland China. Counsel review required before M5 (the trading-everywhere milestone).

## Out of scope

- The `compound-interest-calculator/` and `ZEC-Backtesting-Engine/` siblings (unchanged from existing scope).
- Third-party services we depend on (Cloudflare, Vercel, Hyperliquid, RevenueCat, Stripe, AdMob, Google Ad Manager). Report those upstream.

## Reporting

Use the same channel as the rest of the repo: the GitHub security advisory at `https://github.com/chan-eth/Financial-Projects/security/advisories/new`, or the maintainer email path described in `/SECURITY.md`. Include `HYPERVIEW:` in the subject line so triage routes correctly.
