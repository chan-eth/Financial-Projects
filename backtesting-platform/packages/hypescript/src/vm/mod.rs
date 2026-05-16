//! Stack VM — 45 opcodes per PLAN §12.4, gas-metered to 65_536 ops/bar,
//! 16 MiB fixed slab heap, zero per-bar allocation (all rings + stream
//! cells allocated at script load).
//!
//! Opcode groups:
//!   - constants / locals (6)
//!   - arithmetic (6)
//!   - comparison + logic (9)
//!   - series (6)
//!   - control flow (5)
//!   - bar accessors (6)
//!   - emission (5)
//!   - utility (3)
//!
//! Gas cost table (decrements on each op):
//!   cheap=1 — arithmetic, locals, bar accessors, jumps
//!   medium=4 — DIV, SLOAD/SPUSH, STREAM_READ, CROSS_*
//!   heavy=16 — STREAM_STEP, CALL_STDLIB, EMIT_*, PLOT
//!
//! Stub today.
