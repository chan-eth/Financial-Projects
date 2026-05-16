# Test trees per PLAN §12.11.
#
#   tests/golden/      lexer/parser/.hvb snapshot tests (regenerate via `cargo insta review`)
#   tests/integration/ end-to-end .hype → bytecode → VM runs against fixture bars
#   tests/diff/        bit-exact differential tests against the TS engine baseline
#   tests/unit/        narrow per-stage Rust unit tests (lexer rules, sema errors, IR passes, VM micro-tests)
#
# Each directory keeps its own *.rs files; Cargo's `[[test]]` entries in
# `Cargo.toml` pick them up. Today only `diff/ema_vs_ts.rs` exists as a
# guardrail; the others fill in as M1 progresses.
