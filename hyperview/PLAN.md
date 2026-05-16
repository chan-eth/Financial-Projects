# HyperView — Implementation Plan

## Context

We are creating **HyperView**, a Hyperliquid-native charting + trading platform shipping on web, iOS, and Android, with an original embedded scripting language called **HypeScript**. The goal is a category-comparable alternative to popular charting apps — same surface concepts (advanced charts, alerts, watchlists, community scripts, in-app trading) — but built natively for Hyperliquid's 24/7 perp + spot markets and with its own original visual identity, original scripting language, and original community/monetization layer. Revenue from day one via ads + premium subscriptions.

Why now: Hyperliquid is one of the fastest-growing perp venues in crypto. No incumbent charting/social app is purpose-built for it. The defensible wedge is HypeScript — a series-first, Hyperliquid-aware scripting language with first-class primitives (funding, OI, liquidations, book imbalance, mark-vs-index basis, vault APRs) that generic scripting languages model poorly.

**IP discipline (non-negotiable).** No 1:1 visual cloning of incumbents, no use of their trademarks, no porting of their script syntax/docs/examples. Lightweight Charts is fine on web (Apache 2.0). HypeScript is original work from scratch.

**Honest scope warning.** User chose the maximum on every axis: three native codebases, custom language with custom Rust→WASM compiler/VM, self-custody trading with sub-account abstraction, day-1 monetization. Realistic timeline for a 3-engineer team is **14–16 months** to a polished public launch with all platforms. We recommend **sequencing platform releases** (web → iOS → Android → trading on all) rather than shipping everything together — see milestones M0–M6.

---

## 1. Folder structure

Native Xcode/Gradle projects do not nest cleanly inside a pnpm workspace. Use a flat layout in `/home/user/Financial-Projects/`:

- `backtesting-platform/` — existing, untouched. Extend its pnpm workspace with new members:
  - `apps/hyperview-worker/` — new Cloudflare Worker (separate from the backtester worker: independent secrets, rate limits, deploy cadence).
  - `packages/hypescript/` — Rust crate (lexer, parser, type checker, IR, VM) + TS wrapper re-exporting compiled WASM. Cargo workspace lives here. Build targets: `wasm32-unknown-unknown`, `aarch64-apple-ios`, `aarch64-linux-android` (via UniFFI for native bindings).
  - `packages/hv-schemas/` — Zod types shared by web + worker; codegen mirrors them to Swift/Kotlin.
  - `packages/hv-charts/` — Lightweight Charts adapters + indicator binding for web.
  - `packages/hv-trading/` — Hyperliquid order signing + sub-account orchestration (TS, reused web + worker; native clients reimplement signing locally — keys never leave the device).
- `hyperview-web/` — Next.js app at repo top level. Separate Vercel project, separate env vars.
- `hyperview-ios/` — Xcode + Swift Package Manager. Sibling, not nested. Consumes generated Swift bindings from `hv-schemas` and `hypescript` (UniFFI).
- `hyperview-android/` — Gradle + Compose. Sibling. Consumes generated Kotlin bindings.

Update `backtesting-platform/pnpm-workspace.yaml` and `.github/dependabot.yml` for the new workspace dirs. Add a new GitHub Actions workflow `hyperview-ci.yml` scoped to `hyperview-*/` and the new `backtesting-platform/{apps,packages}/hyperview-*` and `hv-*` dirs (mirror the existing `ci.yml` matrix; add Rust + cargo audit + native build jobs).

**Critical existing files to mirror/extend:**
- `backtesting-platform/apps/worker/src/auth.ts` — template for the new worker's auth fence (passkey + per-user scoping on top of the existing Cloudflare Access + internal-secret model).
- `backtesting-platform/packages/data/src/hyperliquid.ts` — existing REST client; wrap and extend for trading + WS in `packages/hv-trading/`.
- `backtesting-platform/infra/d1/migrations/0001_init.sql` and `0002_audit.sql` — pattern to follow for new migrations.
- `backtesting-platform/.husky/pre-commit` — secret-scan hook; ensure new file types are covered.
- `backtesting-platform/README.md` "Security model" — the new worker's README diffs against this and documents deltas, doesn't replace it.

---

## 2. HypeScript language

### Identity and lexicon

HypeScript is series-first, Hyperliquid-native, statically typed with gradual escape hatches, deterministic, sandboxed. File extension: `.hype`. Compiler binary: `hypec`. Package manager / Scriptshop CLI: `kitty`. Language server: `hype-lsp`. Browser playground at `play.hyperview.xyz` runs the WASM compiler in-page.

**Surface keywords (fun where it does real semantic work, professional everywhere else):**

| Keyword | Role |
|---|---|
| `hype` | Script-unit declarator. `hype indicator "RSI Div" { ... }`, `hype strategy "MA Cross" { ... }`, `hype screener "Funding Outliers" { ... }`. Three kinds total. |
| `house` | Module/import scope. `from house.ta import ema, rsi`, `from house.hl import funding, oi`. Used only in import paths. |
| `purr` | Emit a positive typed signal. `purr when ta.rsi(close, 14) crosses above 30 and hl.funding < 0`. Consumed by chart, alerts, and strategy code. |
| `hiss` | Emit a warning/negative typed signal. Counterpart to `purr`. |
| `pounce` | Strategy-only imperative trade action. `pounce long size = risk.percent(2%) when signal.fresh`. Includes cooldown semantics. |
| `nap` | Cooldown primitive. `nap 4 bars after pounce`. Compiles to a state machine in the VM. |
| `crosses above` / `crosses below` | Binary operators on series. Professional, readable. |

Types stay deliberately boring: `int`, `float`, `bool`, `string`, `bar`, `series<T>`, `signal`, `order`. Error messages are pedantic and helpful — no jokes; this is the bar for quant adoption.

### Compiler pipeline (Rust, ~6 months core build)

1. **Lexer** (hand-rolled, ~1500 LOC).
2. **Parser** — recursive descent + Pratt for expressions, error-recovery for LSP diagnostics.
3. **Semantic analyzer** — name resolution, capability check, series-rank inference.
4. **IR** — typed SSA. Constant folding, DCE, series-fusion pass (collapses nested TA calls into one bar loop).
5. **Bytecode + VM** — stack VM, ~80 ops, target compact (<50 KB per script). Compiled to WASM (web/worker) + static libs (iOS/Android via UniFFI).

### Type system

Gradual + structural, with a **series-rank dimension** (`T` vs `Series<T>`; scalars broadcast over series). Records are structural. Effects/capabilities are row-typed effect sets on function signatures (every function declares what it reads and emits). **No user-defined generics in v1** — defer. Stdlib uses overload sets resolved at compile time.

### Runtime model

Bar-by-bar by default; IR fusion vectorizes inner loops where safe. Lookback (`close[5]`) is compile-time constant; dynamic offsets require an explicit `lookback(n)` annotation that pre-allocates a ring buffer. **Capability declarations are enforced at the VM boundary, not just at compile time** — uploaded bytecode is re-checked.

### Sandboxing limits

200ms CPU per evaluation (edge), 5s (backtest worker), 16 MB heap, 65k bytecode ops max per bar (deterministic gas counter), no syscalls, no network, no filesystem. Order-emitting scripts require an extra signed user authorization at install time.

### Stdlib v1 namespaces (~120 functions total)

- `ta.*` — moving averages, oscillators, bands, pivots (~25)
- `math.*` — arithmetic, stats, distributions (~20)
- `series.*` — slice, shift, fill, resample (~15)
- `hl.market.*` — price/volume/OHLC (~10)
- `hl.derivs.*` — funding, OI, mark vs index basis, liquidation tape (~12)
- `hl.book.*` — top-of-book, depth, imbalance, microprice (~8)
- `hl.vault.*` — HLP APR, vault flows (~5)
- `chart.*` — plot, fill, shape, label, hline (~10)
- `alert.*` — threshold, cross, persistence-debounced (~8)
- `trade.*` — strategy primitives (long/short/close/stop/tp/size) (~8)
- `risk.*` — position size, vol targeting, kelly cap (~8)
- Plus `signal.*` for the `purr`/`hiss` event model (~6)

Anything beyond ships in the community Scriptshop, not core.

### Tooling that ships with v1

- Tree-sitter grammar (free highlighting in web playground, Neovim, GitHub).
- LSP server in Rust reusing the compiler (hover, goto-def, diagnostics, completion). Defer rename/refactor to v1.1.
- Browser playground — WASM compiler in-page, no server roundtrip.
- Docs site (**hypescript.dev**) generated from stdlib doc comments. Every example runs in CI against fixture series.

---

## 3. Backend services

Extend the existing CF Worker + Vercel monorepo. **Separate** new worker (`apps/hyperview-worker/`) for audit + secret isolation.

- **WebSocket fan-out** via **Durable Objects** (one DO per `(symbol, channel)` tuple). DO pulls from Hyperliquid WS once, fans out to subscribers, hibernates when idle. Sufficient through tens of thousands of users. A dedicated Rust service on Fly.io is post-MVP.
- **HypeScript evaluation — two tiers:**
  - *Edge*: indicator + alert eval runs inside the WebSocket DO on each new bar, same WASM module, sub-millisecond per script.
  - *Backtest/research*: separate queue-backed worker, mirroring `backtesting-platform/packages/engine` checkpointing. Scripts exceeding 5min go to a future dedicated container service.
- **Accounts + sub-accounts.** Passkey auth (WebAuthn web, AuthenticationServices iOS, Credential Manager Android). Worker stores only public addresses + signed sub-account authorizations. Keys never reach the worker.
- **Order routing.** `POST /orders` accepts client-signed payloads. Worker validates with Zod, applies per-user token-bucket rate limit (Workers KV), idempotency-key dedup, retries with backoff, post-trade reconciliation via fills WS into D1.

**D1 schema additions** (new migrations `0010_*.sql` through `0017_*.sql`):
- `hv_user`, `hv_subaccount`, `hv_watchlist`, `hv_alert`, `hv_script`, `hv_subscription`, `hv_ad_impression` (raw rows ≤14 days, hourly aggregates in second table), `hv_order_intent`.

**R2 prefixes:** `scripts/<id>/<version>/source.hype` + `bytecode.hvb`, `bars/<symbol>/<tf>/<yyyymm>.parquet` (reuse backtester schema), `replay/<user>/<session>.jsonl` (opt-in debug, time-boxed).

---

## 4. Native client architecture

### iOS — Metal renderer

- `ChartScene` owns `MTLDevice` + `MTKView`. Per-series `MTLBuffer`s (double-buffered for in-flight frames). Bars are instanced quads — one draw call per series.
- Lines drawn via triangle strip with screen-space normal thickening in vertex shader (no CPU fat-line geometry).
- Viewport math in Swift; pan/zoom updates a single uniform buffer.
- Text via Core Text glyph atlas — no per-frame layout.
- CPU-side spatial index for crosshair hit-testing.
- **Performance target:** 60 fps with up to 20k visible candles + 10 indicators on A15+. Beyond 20k, downsample via LTTB. **Build downsampling in from day one** — literal 50k candles is physically more bars than pixels.

### Android — Skia via Compose

- Skia (via `Modifier.drawWithCache` + GPU-backed `Path`s per series), not raw Vulkan. Compose integration is native; we share the conceptual approach with Lightweight Charts internally; we avoid writing two shader languages.
- Recompose only on viewport change.
- Reconsider in a 1-week M2 spike: could Skia-on-iOS share more code with Android? Risk: 60fps headroom on iOS.

### HypeScript on native

Rust VM ships as static lib via **UniFFI** (one IDL → Swift + Kotlin bindings). Bytecode fetched signed + version-pinned from the worker, cached on device, evaluated locally. WebView embedding is rejected — JS↔native marshaling is too expensive at chart tick rate.

---

## 5. Wallet + trading flow

**Local signing key — be honest with users about hardware properties:**
- iOS Secure Enclave does P-256 only, not secp256k1. So: secp256k1 trading key is generated in user space, *wrapped* with an SE-held key, stored in Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` + `biometryCurrentSet`.
- Android: same shape — secp256k1 key wrapped with a Keystore AES key, `setUserAuthenticationRequired(true)`, StrongBox-backed where available.
- The **passkey** (P-256) handles account login and server auth. The **secp256k1 key** handles Hyperliquid order signing. Keep them separate in UI and code.
- Every signature requires fresh biometric prompt. No "remember me" bypass.

**Sub-account abstraction.** Created lazily on first trade. UI calls them "Strategies" (Strategy A, Strategy B) with a power-user toggle to reveal addresses. Default UX: all trades go to the main account; sub-accounts are opt-in behind a disclosure modal explaining margin isolation tradeoffs. **Legal review required on the disclosure flow before M5.**

**External wallets.** WalletConnect v2 on web; native deep links to MetaMask/Rabby/Phantom on mobile. UX is worse; steer normal users to the on-device flow.

**Order flow end-to-end.** Tap Buy → client builds unsigned Hyperliquid action → biometric prompt → secp256k1 sign locally → POST signed payload to worker with idempotency key → worker validates Zod, rate-limits, forwards to Hyperliquid → writes `hv_order_intent` with returned `oid` → worker subscribes to fills WS, updates row → client subscribes via worker WS proxy.

---

## 6. Monetization (day-1)

**Placements:** chart-bottom banner (320×50), watchlist row inserts every 8 rows, Scriptshop browse banner, cold-start interstitial on free tier (max one per 24h — Apple limit). **Never** in the order ticket.

**Networks:** AdMob mobile, Google Ad Manager web. Crypto-native networks (Coinzilla, Bitmedia) deferred — lower fill, worse policies.

**Premium tier.** RevenueCat (iOS + Android IAP) + Stripe (web). Single source of truth = worker `hv_subscription` table, fed by both webhooks. Server-side gate on every premium API call. Gates: ad removal, >5 alerts, >3 saved scripts, sub-1m timeframes, Scriptshop publishing, advanced indicators.

**App-store risks — single biggest schedule landmine:**
- *Apple*: ads + crypto + IAP in one app triggers extra review. Build the iOS positioning as **self-custody wallet + signing tool**, not "we trade for you." Have a back-pocket plan to ship iOS v1 **ad-free** if reviewers push back, adding ads in 1.1.
- *Google*: more permissive but financial-services policy still requires operator entity disclosure and registered crypto-exchange status in supported regions.
- *Both*: premium **must** be sold via IAP on mobile. Stripe-on-mobile for premium = guaranteed rejection.

---

## 7. Security hardening (delta vs. existing model)

**Mobile**
- Cert pinning to `api.hyperview.xyz` and `api.hyperliquid.xyz` (current + backup pins, documented rotation runbook).
- App Attest + DeviceCheck (iOS), Play Integrity API (Android). Worker requires valid attestation on `POST /orders`.
- Jailbreak/root detection — refuse to load signing key if detected; treat as friction, not security.
- Screenshot/screen-record block on order entry and seed-display screens.
- Biometric gate on every signature.

**Backend**
- Per-user token-bucket rate limits (KV-keyed) on top of existing IP limits.
- Trading endpoints gated by a distinct auth scope requiring recent biometric attestation.
- Anomaly detection: sliding-window — >10× user's 30d p99 order rate → soft-block requiring re-auth.
- Audit log shipped off D1 within 5 minutes to R2 cold storage; 7-day hot window in D1. (Closes a gap the existing backtesting-platform README already calls out.)
- Quarterly secret rotation runbook for `WORKER_INTERNAL_SECRET`, AdMob/Stripe/RevenueCat keys.

**HypeScript runtime**
- VM enforces resource limits, not just compiler.
- Scriptshop supply chain: manifest validation + passkey signature + denylist static check + "unverified" badge by default. Manual review for "verified" badge. Treat Scriptshop like an app store, not npm.
- Per-script telemetry; slow/crashing/high-resource scripts auto-quarantined.

**Regulatory / geo (launch posture)**
- Allowlist, not denylist. Open at launch: EU + select APAC + LATAM. Geo-block: US (until counsel signs off — BSA/state MTL strategy or a vetted "wallet tool only" carve-out), UK (FCA promotion rules), OFAC list, mainland China. **Counsel review before M5.**

---

## 8. Milestone phasing (sequenced, not all-at-once)

Targets assume a 3-engineer team. Solo founder = double.

| Milestone | Weeks | Ships |
|---|---|---|
| **M0 — Foundations** | 4 | Monorepo wiring, CI matrix (incl. Rust + cargo audit + native builds), D1 migrations 0010–0017, passkey auth e2e on web, market-data worker (REST proxy), Lightweight Charts on web showing live BTC perp. Internal preview at `staging.hyperview.xyz`. |
| **M1 — HypeScript v0** | 6 | Rust crate: lexer/parser/typecheck/IR/VM, ~30 stdlib fns (`ta`, `math`, `series`, `hl.market`), WASM target, in-page playground. **No native yet.** |
| **M2 — Web MVP** | 5 | Watchlists, alerts via DO, saved scripts, Scriptshop browse (read-only), Stripe premium, ad slots (test ads), full stdlib v1 (~120 fns). Closed beta on web. *1-week Skia-on-iOS spike here.* |
| **M3 — iOS MVP** | 8 | Metal renderer, UniFFI VM, Secure-Enclave-wrapped wallet, biometric sign, RevenueCat IAP, AdMob. **View + alerts only — no trading.** TestFlight beta. *Apple review starts; budget 4 weeks of back-and-forth.* |
| **M4 — Android MVP** | 6 (can overlap M3 by ~50% with a 2nd engineer) | Compose + Skia, same VM, Keystore wallet, Play Integrity, RevenueCat, AdMob. Play Store internal track. |
| **M5 — Trading everywhere** | 6 | Order signing flow, sub-account abstraction, order-routing worker, fills reconciliation. Re-submit iOS for trading capability. Live trading to limited cohort. *Legal review on sub-account disclosure.* |
| **M6 — Public launch** | 4 | Scriptshop publishing, second-pass security review, geo-block finalized, marketing site, public iOS + Android + web. |

**Engineering-only total: 39 weeks (~9 months).** **Realistic with app-store review cycles, language redesign at ~M1.5, and inevitable scope creep: 14–16 months.**

---

## 9. Code audit in segments (per-milestone gate)

Every milestone ends with a **gate review** before merge to `main`. All four checks mandatory:

1. **Static** — `pnpm -r typecheck` + `cargo clippy --all -- -D warnings` + Swift/Kotlin lint clean. No new `eslint-disable` / `#[allow]` / `@Suppress` without referenced ticket.
2. **Tests** — 60% line coverage on HypeScript VM, 40% on UI. Integration test for one happy-path + one denied-path on every new endpoint. Snapshot test for chart renderer at 3 viewport sizes per platform.
3. **Security review checklist** — threat-model diff vs prior milestone, dependency audit (`pnpm audit --audit-level=high`, `cargo audit`, OWASP MASVS spot-check on mobile additions), key-handling code re-read by a second engineer, IAM/RBAC review on new endpoints.
4. **Manual red-team session** — 2 hours, two engineers, targeted at new code surface. One-page memo: "no findings" or "findings ticketed and fixed before this gate passes."

Merge to `main` blocked until all four pass. Each gate produces a tagged release (`hyperview-m3-2026-08-21`) so regressions can bisect to a known-good audit point.

---

## 10. Verification (how we know it works end-to-end)

At M0:
- `pnpm -r typecheck && pnpm -r build && cargo build --release` clean.
- `curl https://staging.hyperview.xyz/api/health` returns ok.
- Web page renders a live BTC-USDC-PERP chart from Hyperliquid REST data.

At each subsequent milestone, the gate (§9) is the verification. Additionally:
- **M1**: `hypec compile examples/rsi.hype` produces bytecode; playground runs it on fixture bars and renders an RSI line matching a known-good snapshot.
- **M2**: Manual e2e — create account, add BTC to watchlist, write a 10-line HypeScript script using `purr when ta.rsi(close,14) > 70`, save alert, simulate threshold crossing in fixture, alert fires.
- **M3/M4**: TestFlight / Play internal track install, biometric login, view live chart, fire alert. Cert pinning verified by MITM proxy refusal. Attestation rejection on rooted/jailbroken device.
- **M5**: Place a $1 limit order on Hyperliquid testnet through the iOS app; verify `hv_order_intent` row, fills reconciliation, idempotency-key dedup on retry.
- **M6**: Third-party security review (pen-test firm) before public launch.

---

## 11. Open risks and unresolved questions

1. **Apple review for ads + crypto + IAP** — biggest schedule risk. Ad-free fallback plan ready for v1 if needed.
2. **HypeScript scope creep** — without ruthless discipline this becomes a 12-month project on its own. v1 ships without user-defined generics, without user modules, without macros. Indicators + strategies + screeners only.
3. **Sub-account disclosure** — needs legal review before M5; support nightmare if users misunderstand isolation.
4. **Cost model unbuilt** — Durable Objects, R2 egress, AdMob fill, RevenueCat (1% of sub rev), Stripe, app-store cuts, Hyperliquid rebate share. Build spreadsheet before M2.
5. **Market-data licensing** — Hyperliquid data is on-chain and permissive, but re-publishing derived analytics commercially should be re-confirmed with their terms.
6. **Native renderer maintenance** — two custom GPU renderers ≈ 4× the long-tail bug load. M2 spike to evaluate Skia-on-iOS code sharing.
7. **US regulatory** — even self-custody + ads + premium may trip state MTL or commodity-broker classifications. Counsel required before M5.
8. **Disaster recovery / SLOs** — what happens when D1 has a 4h outage and an alert misses a 10% move? Need SLO doc and out-of-band fallback (push trigger from second region) before M6.
9. **Talent risk** — Rust compiler + Metal + Skia/Compose + Hyperliquid SDK = 4 specialists. Below this headcount, timeline doubles.
