# @hv/worker — HyperView Cloudflare Worker

Separate from the existing `apps/worker/` (the backtester worker). Reasons: independent secrets, independent rate-limit namespaces, independent deploy cadence, easier audit boundary.

## Responsibilities

| Endpoint family | Notes |
|---|---|
| `GET /health` | Liveness + version probe. |
| `POST /auth/passkey/*` | WebAuthn challenge + verification. |
| `GET /market/*` | REST snapshots of Hyperliquid market data (proxies + caches). |
| `WS /stream/:symbol/:channel` | Durable Object fan-out for live data. One DO per `(symbol, channel)` tuple, hibernating when idle. |
| `POST /orders` | Accepts client-signed Hyperliquid actions, validates with Zod, enforces idempotency + rate limits, forwards to Hyperliquid, reconciles fills. |
| `POST /alerts` | Create/update alerts evaluated edge-side inside the stream DOs. |
| `GET /scripts/*`, `POST /scripts/publish` | Scriptshop browse + publish. |
| `POST /billing/webhook/{stripe,revenuecat}` | Subscription entitlement sync into D1. |

## Status

**M0 scaffolding.** Currently contains a health endpoint stub and an auth-fence skeleton. Real endpoints land in M0 (health + market REST proxy), M1 (scripts read), M2 (alerts + scripts publish + billing), M5 (orders).

## Local dev

```bash
pnpm --filter @hv/worker dev
```

Uses `wrangler dev` with the `wrangler.toml` in this folder. Bindings are local-only stubs at M0.

## Deploy

```bash
pnpm --filter @hv/worker deploy:staging
pnpm --filter @hv/worker deploy:production
```

Both require `wrangler login` and the secrets listed in §Environment below.

## Environment

Secrets (set via `wrangler secret put`):

- `WORKER_INTERNAL_SECRET` — server-to-server auth from the Vercel proxy. Constant-time compared.
- `STRIPE_WEBHOOK_SECRET`, `REVENUECAT_WEBHOOK_SECRET` — billing webhook signature verification.
- `ADMOB_VERIFICATION_KEY` (deferred to M6).

Env vars (in `wrangler.toml`):

- `ALLOWED_ORIGINS` — origin allowlist. Per-env.
- `HYPERLIQUID_API_BASE` — defaults to mainnet; testnet override in staging.
- `RATE_LIMIT_*` — bucket sizes per endpoint family.

## Security

This worker extends — and does not replace — the model documented in `backtesting-platform/README.md` "Security model" and in `hyperview/docs/SECURITY.md`. Read both before adding a new endpoint.
