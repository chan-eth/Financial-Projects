# HypeScript — language identity and v0 sketch

> Status: **identity sketch only**. The full grammar, type system, and stdlib reference are deliverables of milestone M1. This document fixes the public-facing identity so naming, file extensions, and namespaces don't churn during compiler implementation.

HypeScript is an original scripting language for Hyperliquid-native indicators, strategies, and screeners. It is not derived from, and does not aim for syntactic compatibility with, any existing charting DSL.

## Identity

| | |
|---|---|
| File extension | `.hype` |
| Compiler binary | `hypec` |
| Package manager / Scriptshop CLI | `kitty` |
| Language server | `hype-lsp` |
| Browser playground | `play.hyperview.xyz` (WASM compiler in-page) |
| Docs site | `hypescript.dev` |

## Design pillars

1. **Series-first.** Every value carries an implicit time-series rank. Scalars broadcast over series. `close - open` is a series expression.
2. **Hyperliquid-native primitives.** Funding rates, open interest, liquidation tape, book imbalance, mark-vs-index basis, vault APRs are first-class typed values, not user-imported helpers.
3. **Deterministic.** No I/O, no clock access beyond the current bar timestamp. Same inputs → same outputs. Required for backtest reproducibility and alert deduplication.
4. **Capability-scoped.** Scripts declare what they read (`series`, `funding`, `book`) and what they emit (`signal`, `alert`, `order intent`). The runtime denies anything undeclared.
5. **Sandboxed by design.** Hard CPU/memory/instruction caps enforced at the VM, not just the compiler. Untrusted bytecode cannot escape.

## Surface keywords

Fun where it does real semantic work; professional everywhere else.

| Keyword | Role |
|---|---|
| `hype` | Script-unit declarator. Three kinds: `indicator`, `strategy`, `screener`. |
| `house` | Module/import scope. Used in import paths only. |
| `purr` | Emit a positive typed signal event. |
| `hiss` | Emit a warning/negative typed signal event. |
| `pounce` | Strategy-only imperative trade action. |
| `nap` | Cooldown primitive (e.g. `nap 4 bars after pounce`). |
| `crosses above` / `crosses below` | Binary operators on series. |

Types stay deliberately plain: `int`, `float`, `bool`, `string`, `bar`, `series<T>`, `signal`, `order`. Error messages are pedantic and helpful.

## Standard library — reserved namespaces (v1)

| Namespace | Scope | Approx. function count |
|---|---|---|
| `ta` | Classical technical analysis (MAs, oscillators, bands, pivots) | ~25 |
| `math` | Arithmetic, statistics, distributions | ~20 |
| `series` | Slice, shift, fill, resample | ~15 |
| `hl.market` | OHLC, volume, price accessors | ~10 |
| `hl.derivs` | Funding, OI, mark vs index basis, liquidation tape | ~12 |
| `hl.book` | Top-of-book, depth, imbalance, microprice | ~8 |
| `hl.vault` | HLP APR, vault flows | ~5 |
| `chart` | Plot, fill, shape, label, hline | ~10 |
| `alert` | Threshold, cross, persistence-debounced | ~8 |
| `trade` | Strategy primitives — long/short/close/stop/tp/size | ~8 |
| `risk` | Position size, vol targeting, kelly cap | ~8 |
| `signal` | Emit/consume `purr` and `hiss` events | ~6 |

Total target for v1: ~135 functions. Anything beyond ships in the community Scriptshop.

## Compiler pipeline (Rust, target ~6 months for v1 core)

1. Lexer — hand-rolled, UTF-8.
2. Parser — recursive descent + Pratt for expressions; error-recovering for LSP diagnostics.
3. Semantic analyzer — name resolution, capability check, series-rank inference.
4. Typed SSA intermediate representation; passes for constant folding, dead-code elimination, series-fusion (collapses nested TA calls into a single bar loop).
5. Stack-based bytecode VM, ~80 opcodes, compact emission (<50 KB per script). Targets: `wasm32-unknown-unknown` (web + edge worker), `aarch64-apple-ios` static library, `aarch64-linux-android` shared library — UniFFI generates Swift + Kotlin bindings from a single IDL.

## Runtime model

Bar-by-bar by default. The IR fusion pass vectorizes inner loops where safe. Constant lookback (`close[5]`) is compile-time; dynamic lookback requires an explicit `lookback(n)` annotation that pre-allocates a ring buffer. This eliminates the accidental O(n²)-per-bar footgun common in naive scripting engines.

## Sandboxing limits (subject to revision in M1)

| Resource | Edge eval | Backtest worker |
|---|---|---|
| CPU per evaluation | 200 ms | 5 s |
| Heap | 16 MB | 16 MB |
| Bytecode ops per bar | 65,536 | 65,536 |
| Syscalls | none | none |
| Network / filesystem | none | none |

Order-emitting scripts (strategies installed into a live account) require an additional one-time signed authorization from the user.

## Scriptshop (community registry)

- Every published script must pass static manifest validation, be signed by author's passkey, and clear a denylist check.
- New scripts start with an "unverified" badge. Manual review is required for the "verified" badge.
- Per-script telemetry — scripts that crash, time out, or consume disproportionate resources are auto-quarantined.

Treated as an app store, not as npm.
