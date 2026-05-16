# HyperView

A Hyperliquid-native charting + trading platform shipping on web, iOS, and Android, with an original embedded scripting language called **HypeScript**.

This folder holds shared specifications, design docs, and the implementation plan. Platform code lives in sibling top-level folders (native projects don't nest cleanly inside a pnpm workspace) and in workspace members of the existing backtesting-platform monorepo.

## Where the code lives

| Path | What it is |
|---|---|
| `hyperview/` (this folder) | Specs, plan, security model deltas, language docs |
| `hyperview-web/` | Next.js app (Vercel) |
| `hyperview-ios/` | Xcode project, Swift, Metal chart renderer |
| `hyperview-android/` | Gradle project, Kotlin, Compose + Skia chart renderer |
| `backtesting-platform/apps/hyperview-worker/` | Cloudflare Worker — market data, alerts, trading proxy, scriptshop API |
| `backtesting-platform/packages/hypescript/` | Rust crate — HypeScript compiler + VM (Rust → WASM + UniFFI native bindings) |
| `backtesting-platform/packages/hv-schemas/` | Shared Zod schemas (codegen targets Swift + Kotlin) |
| `backtesting-platform/packages/hv-charts/` | Lightweight Charts adapters and indicator binding for web |
| `backtesting-platform/packages/hv-trading/` | Hyperliquid order signing + sub-account orchestration (TS) |

## Documents

- [`PLAN.md`](./PLAN.md) — full implementation plan, milestones M0–M6, audit-in-segments protocol
- [`docs/HYPESCRIPT.md`](./docs/HYPESCRIPT.md) — language identity and v0 spec sketch (full spec developed in M1)
- [`docs/SECURITY.md`](./docs/SECURITY.md) — security model delta vs. the existing backtesting-platform model

## Current status

**M0 — Foundations.** Directory scaffolding only. No working code yet. See `PLAN.md` §8 for milestone definitions and `PLAN.md` §9 for the per-milestone audit gate that must pass before moving forward.
