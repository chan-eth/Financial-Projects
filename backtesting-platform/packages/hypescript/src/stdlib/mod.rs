//! Stdlib v0 — 30 functions + 5 series accessors per PLAN §12.5.
//!
//! Kinds:
//!   (P) pure scalar    — math.*: abs, min, max, clamp, round, floor, ceil,
//!                                 log, sqrt, pow
//!   (E) elementwise    — series.*: shift, change, highest, lowest, mean, stddev
//!   (S) stateful       — ta.*: sma, ema, wma, rsi, atr, macd, bbands_upper,
//!                              bbands_lower, stoch, vwap
//!   accessors          — hl.market.*: close, open, high, low, volume
//!                                     (compile to BAR_* + SPUSH, not function calls)
//!                                     plus bar_time(), bar_index()
//!
//! Reserved namespaces (lexer-recognized, sema-rejected with HV322):
//!   hl.derivs, hl.book, hl.vault, chart, alert, trade, risk, signal
//!
//! Stub today — each function will be a `(EffectRow, StreamingKind,
//! BodyHandler)` entry in the overload table that [`crate::sema`] consults.
