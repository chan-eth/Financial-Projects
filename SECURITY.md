# Security policy

## Reporting a vulnerability

Please **do not** open public GitHub issues for security problems. Instead:

1. Use GitHub's **"Report a vulnerability"** flow on
   <https://github.com/chan-eth/Financial-Projects/security/advisories/new>,
   which creates a private security advisory only the maintainers can see, or
2. Email the maintainer at the address on their GitHub profile with a subject
   line starting with `SECURITY:`.

Either channel is fine. The first is preferred because it links the report,
the discussion, and any fix into one private timeline.

## Scope

In scope:

- `backtesting-platform/` (the Next.js UI, the Cloudflare Worker, the shared
  TypeScript packages, the ingest scripts, the D1 migrations, the wrangler
  configuration).
- The deployed services at `getdebanked.xyz` and `api.getdebanked.xyz` once
  they go live.
- The CI / Dependabot configuration under `.github/`.

Out of scope:

- The `compound-interest-calculator/` and `ZEC-Backtesting-Engine/` siblings —
  they are separate projects.
- Third-party services we depend on (Cloudflare, Vercel, Kalshi, Hyperliquid,
  CF Benchmarks). Report those to the providers directly.

The defenses currently in place are documented in
[`backtesting-platform/README.md` → "Security model"](backtesting-platform/README.md#security-model).
That section also lists the gaps we know about but haven't closed yet (audit-
log retention/export, per-user resource quotas, staging environment isolation
beyond bindings).

## What to expect

- Acknowledgement within 72 hours.
- An initial assessment (in-scope? reproducible? rough severity?) within 7 days.
- A fix timeline scaled to severity. Critical/high vulnerabilities affecting
  deployed services are prioritized over everything else.
- Credit in the advisory when the fix lands, unless the reporter requests
  otherwise.

## Bounty

There is no bug bounty program at this time. Reports are appreciated all the
same.
