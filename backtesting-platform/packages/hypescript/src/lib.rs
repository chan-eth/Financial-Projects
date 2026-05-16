//! HypeScript compiler + VM library.
//!
//! Public surface stabilizes as M1 modules land. Today's scaffold registers
//! the planned module tree (per PLAN §12.3 / §12.11) so that downstream
//! refactors don't have to move imports as implementation arrives.
//!
//! Pipeline (per PLAN §2 + §12.3):
//!
//!   source → [lexer] → tokens → [parser] → [ast] → [sema] →
//!     typed-AST → [ir] (typed SSA) → [pass] (fold/DCE/series-fusion) →
//!     [codegen] → bytecode (.hvb) → [vm] (stack VM)
//!
//! The [`stdlib`] module declares the builtin overload tables that [`sema`]
//! and [`codegen`] both consult.

#![allow(unused)] // Until M1 modules fill in — keeps `cargo check` quiet.

pub mod ast;
pub mod codegen;
pub mod ir;
pub mod lexer;
pub mod parser;
pub mod pass;
pub mod sema;
pub mod stdlib;
pub mod vm;

/// Compile-time version banner. Bumped per milestone.
pub const VERSION: &str = "0.0.0-m1-scaffold";
