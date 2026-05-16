# @hv/hypescript

HypeScript compiler and VM. Written in Rust; ships to web (WASM), iOS (static lib via UniFFI), and Android (shared lib via UniFFI).

## Status

**M0 scaffolding** — crate skeleton only. The compiler implementation is the bulk of M1 (six weeks).

## Identity

See `../../../hyperview/docs/HYPESCRIPT.md` for the public-facing language identity (keywords, namespaces, design pillars). This package is the implementation; the spec lives in the hyperview docs folder.

## Crate layout (planned for M1)

```
src/
├── lib.rs           — public crate surface; re-exports
├── lexer.rs         — UTF-8 tokenizer
├── parser.rs        — recursive descent + Pratt for expressions
├── ast.rs           — typed AST nodes
├── sema/            — name resolution, capability checks, series-rank inference
├── ir.rs            — typed SSA intermediate representation
├── pass/            — constant fold, DCE, series fusion
├── codegen.rs       — bytecode emission
├── vm.rs            — stack VM, gas counter, sandbox
├── stdlib/          — built-in functions (ta, math, series, hl.*, chart, alert, trade, risk, signal)
└── uniffi.udl       — bindings IDL for Swift + Kotlin
```

## Build targets

| Target | Triple | Consumer |
|---|---|---|
| WASM | `wasm32-unknown-unknown` | hyperview-web playground, hyperview-worker edge eval |
| iOS | `aarch64-apple-ios` + `aarch64-apple-ios-sim` | hyperview-ios via UniFFI Swift bindings |
| Android | `aarch64-linux-android` + `armv7-linux-androideabi` | hyperview-android via UniFFI Kotlin bindings |

## CLI binaries (planned)

- `hypec` — compile a `.hype` source file to bytecode.
- `kitty` — package manager and Scriptshop client (publish, install, search).

## Sandboxing

Resource limits are enforced **at the VM boundary**, not just the compiler — see `hyperview/docs/SECURITY.md`. Uploaded bytecode is re-validated before execution.

## Tests

`cargo test` once the crate is real. Unit coverage target for M1 gate: 60% lines on the VM. Fixture bars + golden bytecode snapshots live in `tests/fixtures/`.
