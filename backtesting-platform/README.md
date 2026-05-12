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

Three environments live side-by-side in `apps/worker/wrangler.toml`: the
top-level block is for `wrangler dev` (placeholder bindings), and the two
`[env.staging]` / `[env.production]` blocks hold the real resources.

Stand staging up first, smoke-test, then repeat for production. Anything
in `< >` is something you fill in.

### Deploying to staging

```bash
# 1. One-time: log in to the right Cloudflare account.
pnpm --filter @bt/worker exec wrangler login

# 2. Create the per-env resources. Paste each printed id/name into the
#    matching [env.staging] block of apps/worker/wrangler.toml.
pnpm --filter @bt/worker exec wrangler d1 create backtest-staging
pnpm --filter @bt/worker exec wrangler r2 bucket create backtest-data-staging
pnpm --filter @bt/worker exec wrangler queues create backtest-jobs-staging
```

3. **Rate-limit namespaces** — Cloudflare dashboard → Workers & Pages →
   Rate Limiting → create two namespaces; paste their integer IDs into the
   `[[env.staging.unsafe.bindings]]` blocks (`RL_GLOBAL`, `RL_RUNS`).

```bash
# 4. Apply migrations to the staging D1.
pnpm --filter @bt/worker migrate:staging

# 5. Set the four secrets. wrangler prompts for each value.
pnpm --filter @bt/worker exec wrangler secret put KALSHI_API_KEY_ID --env staging
pnpm --filter @bt/worker exec wrangler secret put KALSHI_PRIVATE_KEY_PEM --env staging
pnpm --filter @bt/worker exec wrangler secret put CFBENCHMARKS_TOKEN --env staging
pnpm --filter @bt/worker exec wrangler secret put WORKER_INTERNAL_SECRET --env staging

# 6. Deploy. Records the *.workers.dev URL; copy it for the smoke test.
pnpm --filter @bt/worker deploy:staging

# 7. Tiny ingest — 7 days for the smoke test before you pay for full coverage.
pnpm tsx scripts/ingest-hyperliquid.ts --symbol BTC --timeframe 1h --days 7

# 8. Upload the produced JSONL to staging R2. (CLIs write to .local-r2/.)
for f in $(find .local-r2/data -type f); do
  key=${f#.local-r2/}
  pnpm --filter @bt/worker exec wrangler r2 object put \
    "backtest-data-staging/$key" --file "$f" --remote
done
```

9. **Smoke test** — replace `<URL>` with the staging `*.workers.dev` URL and
   `<SECRET>` with the value you set for `WORKER_INTERNAL_SECRET`:

```bash
curl -s -X POST "<URL>/runs" \
  -H "content-type: application/json" \
  -H "x-internal-secret: <SECRET>" \
  -d '{"config":{"strategy":{"kind":"hyperliquid","symbol":"BTC","timeframe":"1h","fastEma":12,"slowEma":48,"riskPerTradeBps":50,"takerFeeBps":4,"makerFeeBps":1,"slippageBps":2},"symbol":"BTC","timeframe":"1h","startTs":'$(($(date +%s) - 7*86400))',"endTs":'$(date +%s)',"initialCashUsd":100000}}'
# -> {"runId":"...","status":"queued"}

# Poll until status === "succeeded":
curl -s "<URL>/runs/<runId>" -H "x-internal-secret: <SECRET>" | jq .run.status

# Fetch the tearsheet:
curl -s "<URL>/runs/<runId>/tearsheet" -H "x-internal-secret: <SECRET>" | jq .metrics
```

If the smoke run succeeds, staging is good. If it `failed`, check the run row's
`metrics_json.error` for the engine error, or `wrangler tail --env staging` for
the Worker logs.

### Deploying to production

Same shape as staging, with three additional steps:

1. **Cloudflare Access** (one-time, dashboard) — Zero Trust → Access →
   Applications → "Add an application". Protect both `getdebanked.xyz` and
   `api.getdebanked.xyz`. Identity provider: GitHub or Google. Policy: `email
   is <list>`. The same emails go in `OPERATOR_EMAILS` in the
   `[env.production.vars]` block.

2. **Wrangler resources, migrations, secrets, deploy** — same commands as
   staging with `--env production` and the prod bucket/queue/D1 names:

```bash
pnpm --filter @bt/worker exec wrangler d1 create backtest
pnpm --filter @bt/worker exec wrangler r2 bucket create backtest-data
pnpm --filter @bt/worker exec wrangler queues create backtest-jobs
# paste IDs into [env.production] in wrangler.toml
pnpm --filter @bt/worker migrate:production
pnpm --filter @bt/worker exec wrangler secret put KALSHI_API_KEY_ID --env production
pnpm --filter @bt/worker exec wrangler secret put KALSHI_PRIVATE_KEY_PEM --env production
pnpm --filter @bt/worker exec wrangler secret put CFBENCHMARKS_TOKEN --env production
pnpm --filter @bt/worker exec wrangler secret put WORKER_INTERNAL_SECRET --env production
pnpm --filter @bt/worker deploy:production
```

3. **Vercel** —

   - Import `chan-eth/Financial-Projects` into Vercel.
   - **Root directory:** `backtesting-platform/apps/web`.
   - Framework preset: Next.js.
   - Env vars:

     | Name                     | Value                                | Scope           |
     | ------------------------ | ------------------------------------ | --------------- |
     | `NEXT_PUBLIC_API_BASE`   | `https://api.getdebanked.xyz`        | all environments |
     | `WORKER_INTERNAL_SECRET` | same value as the Worker secret      | production server only |

   - Domain: assign `getdebanked.xyz`. The browser only ever talks to Vercel;
     Vercel server-side proxies through
     `apps/web/app/api/proxy/[...path]/route.ts` and attaches `x-internal-secret`.

4. **DNS** — `api.getdebanked.xyz` → Worker route (declared in
   `wrangler.toml`); `getdebanked.xyz` apex → CNAME-flatten to
   `cname.vercel-dns.com`.

### Continuous integration

`.github/workflows/ci.yml` already runs `pnpm install` → `pnpm -r typecheck` →
engine tests → web build → `pnpm audit --audit-level=high` on every PR
touching `backtesting-platform/**`. Set this check as **required** in branch
protection. Worker + Vercel deploys are intentionally manual today —
auto-deploy is a Phase 2 follow-up (see `Known follow-ups`).

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
