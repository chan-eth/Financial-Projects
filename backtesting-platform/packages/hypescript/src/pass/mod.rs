//! Optimization passes per PLAN §12.3:
//!   1. constant folding
//!   2. dead-code elimination
//!   3. series fusion — collapse nested TA calls into one per-bar update
//!   4. lookback-window analysis — sizes the VM's ring buffers
//!   5. defensive capability re-check — panics on internal-invariant
//!      violations (never surfaced as a user error)
//!
//! Stub today.
