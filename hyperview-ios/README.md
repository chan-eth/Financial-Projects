# hyperview-ios

Native iOS app for HyperView. Swift + SwiftUI + custom Metal chart renderer.

## Status

**M0 scaffolding only — no Xcode project yet.** The Xcode project is created at the start of M3 once the web MVP (M2) has validated the data contracts and HypeScript bytecode format.

## Planned structure (placeholder)

- `HyperView.xcodeproj/` — Xcode project (created at M3).
- `HyperView/` — app target. SwiftUI host, Metal chart view, Hyperliquid signing, RevenueCat IAP, AdMob.
- `HypeScriptCore/` — Swift wrapper around the UniFFI-generated Rust bindings for the HypeScript VM.
- `Generated/` — checked-in codegen output from `backtesting-platform/packages/hv-schemas` (`pnpm hv:codegen:swift`).
- `Tests/` — XCTest target.

## Architecture pointers

- Metal chart renderer design: see `../hyperview/PLAN.md` §4.
- Wallet + key handling (Keychain + Secure-Enclave-wrapped secp256k1 trading key, separate from P-256 login passkey): see `../hyperview/PLAN.md` §5.
- Security additions vs. the existing backtesting-platform model (cert pinning, App Attest, biometric gating, screenshot block): see `../hyperview/docs/SECURITY.md`.

## Build (once Xcode project exists)

Standard Xcode build. Native bindings are produced by `cargo build --target aarch64-apple-ios --release` in `backtesting-platform/packages/hypescript/` and exposed via UniFFI; the build script will be wired in M3.
