# Backtesting Platform

Interactive backtester for the **Hyperliquid bot** (perps + spot) and the **Kalshi
15-min crypto markets bot** (BTC / ETH / SOL / DOGE / HYPE, settled against CF
Benchmarks indices). UI hosted at `getdebanked.xyz` (Vercel); data plane +
compute on a Cloudflare Worker (`api.getdebanked.xyz`) with D1 + R2 + Queues.

```
        Browser ─▶  Next.js 16 (Vercel)  ─HTTPS─▶  Cloudflare Worker
                    UI only, no secrets             D1 (meta) + R2 (series) + Queue (jobs)
```

## Layout

```
backtesting-platform/
  apps/web/                  # Next.js 16 — Vercel root dir
  apps/worker/               # Cloudflare Worker (router + queue consumer)
  packages/engine/           # pure TS engine (Workers + Node + Vitest)
  packages/data/             # typed clients: Hyperliquid, Kalshi, CF Benchmarks
  packages/schemas/          # zod types shared end-to-end
  infra/d1/migrations/       # D1 SQL migrations
  scripts/                   # ingest CLIs + demo seed
```

## Local quickstart

```bash
pnpm install
pnpm --filter @bt/engine test         # engine unit tests
pnpm --filter @bt/web build           # Next.js build
pnpm tsx scripts/seed-demo-run.ts     # synthetic 70-day backtest → ./.local-r2/...
```

Run the web UI against the demo run:

```bash
pnpm --filter @bt/web dev
# then visit http://localhost:3000
```

The Worker can be run locally too:

```bash
pnpm --filter @bt/worker exec wrangler d1 migrations apply backtest --local
pnpm --filter @bt/worker dev
```

## Ingest CLIs (70-day window)

Kalshi crypto markets have not been live longer than ~70 days, so the ingest
window for Phase 1 is bounded to that. Each CLI defaults to `--days 70`.

```bash
pnpm tsx scripts/ingest-hyperliquid.ts --symbol BTC --timeframe 1h --days 70
pnpm tsx scripts/ingest-kalshi.ts      --series KXBTC                --days 70
pnpm tsx scripts/ingest-brti.ts        --index BRTI                  --days 70
```

Output lands in `./.local-r2/<key>` keyed per the conventions in
`packages/data/src/r2-parquet.ts`. Push to remote R2 with `wrangler r2 object
put` or by switching the CLIs to the `@cloudflare/r2` SDK in Phase 2.

## Deployment

### 1. Cloudflare Worker + D1 + R2 + Queue

```bash
# from apps/worker
wrangler login
wrangler d1 create backtest                # paste database_id into wrangler.toml
wrangler r2 bucket create backtest-data
wrangler queues create backtest-jobs

wrangler d1 migrations apply backtest --remote

wrangler secret put KALSHI_API_KEY_ID
wrangler secret put KALSHI_PRIVATE_KEY_PEM
wrangler secret put CFBENCHMARKS_TOKEN
wrangler secret put WORKER_INTERNAL_SECRET

wrangler deploy
```

In Cloudflare DNS, point `api.getdebanked.xyz` at this Worker (route is
declared in `wrangler.toml`).

### 2. Vercel (apps/web)

* Import `chan-eth/Financial-Projects` into Vercel.
* **Root directory:** `backtesting-platform/apps/web`.
* Framework preset: Next.js.
* Environment variables:

  | Name                        | Value                                          | Scope    |
  | --------------------------- | ---------------------------------------------- | -------- |
  | `NEXT_PUBLIC_API_BASE`      | `https://api.getdebanked.xyz`                  | client + server |
  | `WORKER_INTERNAL_SECRET`    | same string set on the Worker                  | server only |

* Domain: assign `getdebanked.xyz`. Cloudflare DNS handles the apex CNAME flatten
  to Vercel's `cname.vercel-dns.com`.

The browser only ever talks to Vercel; Vercel proxies through
`apps/web/app/api/proxy/[...path]/route.ts` to the Worker, attaching
`x-internal-secret`. Worker secrets never reach the bundle.

### 3. CI (optional, recommended)

* GitHub Action on push to `main` touching `apps/worker/**` or `packages/**`
  runs `pnpm install`, `pnpm --filter @bt/worker exec wrangler deploy`, and
  `wrangler d1 migrations apply backtest --remote`.
* Vercel auto-deploys on push (ignore-build script: skip when only
  `apps/worker/**`, `packages/**`, `scripts/**` changed).

## Security model

The defenses layered between a browser request and a state change:

1. **Cloudflare Access** (dashboard config) sits in front of `getdebanked.xyz` and `api.getdebanked.xyz`. Identity provider = Google/GitHub; policy = `email in {operator emails}`. Browser users hit the IdP before they ever reach Vercel or the Worker.
2. **Origin allowlist** in the Vercel proxy (`apps/web/app/api/proxy/[...path]/route.ts`) rejects cross-site `fetch`/form posts that don't come from `getdebanked.xyz`, `*.vercel.app`, or same-host dev. CSRF fence.
3. **Method + size + timeout caps** in the same proxy: only GET/POST/HEAD, body ≤ 256 KB, upstream `fetch` aborted at 30 s.
4. **Worker auth fence** (`apps/worker/src/auth.ts`) accepts a request iff (a) `Cf-Access-Authenticated-User-Email` is set *and* listed in `OPERATOR_EMAILS`, or (b) the Vercel server-to-server `x-internal-secret` matches. Constant-time comparison.
5. **Rate limiting** via Cloudflare's native binding: 60 req/min/IP globally and 10 `POST /runs`/min/IP. Access-authenticated operators bypass. Returns 429 with `Retry-After` on limit.
6. **Idempotency** on `POST /runs`: an optional `Idempotency-Key` header collapses retries to a single row (sha256-derived deterministic runId).
7. **Input validation** at the zod boundary: UUID-format runIds, regex-validated symbols (`/^[A-Z0-9._-]+$/i`, 1–64 chars), `startTs < endTs` refine.
8. **Parameterized SQL everywhere** (D1 prepared statements) + JSON column writes that never interpolate user input.
9. **Sanitized errors**: 4xx are explicit, 5xx is opaque with a server-side `requestId` in the logs.
10. **Security headers** from Next.js (`apps/web/next.config.mjs`): CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Worker also sets `X-Content-Type-Options` + `Referrer-Policy` on its JSON responses.
11. **CI on every PR** (`.github/workflows/ci.yml`): typecheck + engine tests + web build + `pnpm audit --audit-level=high`.
12. **Dependabot weekly PRs** for npm + GitHub Actions (`.github/dependabot.yml`).
13. **Pre-commit secret scan** (`.husky/pre-commit`) blocks PEM keys, AWS keys, GitHub tokens, Stripe live keys, and project-specific `KALSHI_PRIVATE_KEY_PEM` from being committed.

What still isn't done and matters before going fully public:
- Audit log retention/exporting (today the columns exist on `runs`, but no rotation).
- Per-user resource quotas beyond rate limits (max queued runs, max R2 usage).
- Vulnerability disclosure policy (`SECURITY.md`).
- A staging environment for the Worker that mirrors prod with isolated D1/R2.

## Hard rules

1. **D1 is for metadata + aggregates only.** Raw OHLCV, L2 frames, full equity
   curves go to R2. Trade rows are written downsampled / batched.
2. **Engine has zero runtime deps and no `node:*` imports.** It must
   cross-compile cleanly to the Workers runtime. Heavy lifting that needs
   `node:fs`/streaming parquet lives in `scripts/` (Node-only).
3. **Long backtests must checkpoint.** Workers cap at 5 min CPU/invocation on
   the paid plan; the engine takes a `checkpointEveryNBars` and an
   `onCheckpoint` callback, and the consumer re-enqueues from the last cursor.
4. **Vercel never holds Worker secrets.** UI → `api/proxy` → Worker. The
   server-side proxy is the only place the internal secret appears.

## Known follow-ups (Phase 2)

* Scheduled-cron ingest worker (incremental refresh past the 70-day window).
* L2 orderbook compare view (Hyperliquid vs. BRTI constituents).
* Walk-forward + Monte Carlo + parameter sweep.
* Auth on `/runs` (Cloudflare Access or session cookie issued by the Worker).
* Live paper-trading using the engine in continuous-bar-feed mode.

## Risks tracked in the plan

See `/root/.claude/plans/can-you-create-a-greedy-umbrella.md` (the approved plan).
The notable open items, summarized:

* CF Benchmarks real-time licensing — sidestepped in Phase 1 by scraping 70
  days of historical/delayed data and reconstructing from constituent exchanges
  where any RTI endpoint is gated.
* Kalshi RSA-signed requests + rate limits — centralized in
  `packages/data/src/kalshi.ts`.
* Worker CPU cap — checkpointing built into the engine.
* D1 size cap — enforced by the "series → R2, summaries → D1" hard rule.
