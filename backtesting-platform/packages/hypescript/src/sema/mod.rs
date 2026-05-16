//! Semantic analyzer — name resolution, series-rank inference, capability
//! checking (PLAN §12.2).
//!
//! Series-rank rules:
//!   - literals → rank 0
//!   - `hl.market.{close,open,high,low,volume}` → rank 1
//!   - rank-0 ⊕ rank-1 broadcasts to rank 1
//!   - `s[k]` requires `k` constant-folded `int >= 0`
//!   - `crosses above/below` requires `series<float>` on both sides
//!
//! Stub today.
