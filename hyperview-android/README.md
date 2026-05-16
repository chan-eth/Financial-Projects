# hyperview-android

Native Android app for HyperView. Kotlin + Jetpack Compose + Skia chart renderer.

## Status

**M0 scaffolding only — no Gradle project yet.** The Gradle project is created at the start of M4, overlapping ~50% with M3 if a second engineer is available.

## Planned structure (placeholder)

- `settings.gradle.kts`, `build.gradle.kts` — root Gradle config (created at M4).
- `app/` — app module. Compose UI, Skia chart via `Modifier.drawWithCache`, Hyperliquid signing, RevenueCat IAP, AdMob.
- `hypescript-core/` — Kotlin wrapper around UniFFI-generated Rust bindings.
- `app/src/main/java/.../generated/` — checked-in codegen output from `backtesting-platform/packages/hv-schemas` (`pnpm hv:codegen:kotlin`).
- `app/src/androidTest/` — instrumentation tests.

## Architecture pointers

- Skia chart renderer design: see `../hyperview/PLAN.md` §4.
- Wallet + key handling (Keystore + StrongBox-wrapped secp256k1 trading key, biometric gating, separate from passkey login): see `../hyperview/PLAN.md` §5.
- Security additions (cert pinning via OkHttp `CertificatePinner`, Play Integrity API on trading endpoints): see `../hyperview/docs/SECURITY.md`.

## Build (once Gradle project exists)

Standard `./gradlew assembleDebug`. Native bindings come from `cargo build --target aarch64-linux-android --release` in `backtesting-platform/packages/hypescript/` and are wired via UniFFI's Kotlin generator — script added in M4.
