# hyperview-web

Next.js web app for HyperView. Separate Vercel project from the backtester, separate env vars, separate deploy cadence.

## Status

**M0 scaffolding.** No working code yet. Next steps land in M0:

1. Next.js 16 + Tailwind + Radix scaffolding (mirror `compound-interest-calculator/` conventions).
2. Passkey (WebAuthn) login wired to `api.hyperview.xyz` (passkey auth endpoint).
3. Lightweight Charts integration via `@hv/charts` package consuming Hyperliquid market data over the worker WS proxy.
4. Server-side proxy route at `/api/proxy/[...path]/route.ts` mirroring the pattern in `backtesting-platform/apps/web` (origin allowlist + auth header injection).

See `../hyperview/PLAN.md` for full milestone definitions.

## Local development (once wired)

```bash
pnpm install
pnpm dev
```

Runs on `localhost:3000`. The worker proxy points at `staging.api.hyperview.xyz` by default (configurable via `NEXT_PUBLIC_API_BASE`).

## Deploy

Vercel project root: `hyperview-web/`. Environment variables documented in `../hyperview/PLAN.md` §3 and §6.
