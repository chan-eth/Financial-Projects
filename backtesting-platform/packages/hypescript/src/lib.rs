//! HypeScript compiler and VM — M0 scaffolding only.
//!
//! Language spec: `hyperview/docs/HYPESCRIPT.md`.
//! Implementation plan: `hyperview/PLAN.md` §2 (compiler pipeline) and §8 (M1 milestone).
//!
//! At M0 this crate intentionally exports nothing usable. The full module tree
//! (lexer, parser, sema, ir, codegen, vm, stdlib) lands across M1.

/// Compile-time version banner. Bumped per milestone.
pub const VERSION: &str = "0.0.0-m0";
