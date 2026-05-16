//! Differential test: HypeScript `ta.ema` vs the TypeScript port in
//! `backtesting-platform/packages/engine/src/strategies/hyperliquid-baseline.ts:ema`.
//!
//! Goal (PLAN §12.8 test 4): identical 5000-bar close vector through both
//! implementations must agree element-wise within `1e-12`. The test is
//! `#[ignore]`d today because the HypeScript VM doesn't exist yet; it flips
//! to `#[test]` when the VM can execute the `ta.ema` stdlib function.
//!
//! Until then this file is a guardrail: anyone moving the engine's `ema`
//! contract has to keep this differential check happy when M1 lands.

#[test]
#[ignore = "VM lands later in M1; differential check enables when ta.ema is runnable"]
fn hypescript_ema_matches_typescript_baseline() {
    // 1. Generate 5000 deterministic close prices (sin + noise) with a seeded
    //    PRNG so the test is bit-reproducible across machines.
    // 2. Compile `examples/ema.hype` (also lands later) to .hvb.
    // 3. Run through the HypeScript VM, collect the output series.
    // 4. Compute the reference series with the Rust port of
    //    `packages/engine/src/strategies/hyperliquid-baseline.ts:ema`:
    //       k = 2 / (period + 1)
    //       ema[0] = first close
    //       ema[i] = k * close[i] + (1-k) * ema[i-1]
    // 5. Assert |hv[i] - ts[i]| <= 1e-12 for every i.
    unimplemented!("HypeScript VM not yet built; see PLAN §12 for the M1 schedule");
}
