//! Lexer — hand-rolled tokenizer per PLAN §2 (~1500 LOC target).
//!
//! Turns `.hype` source into the token stream the parser consumes. Recognizes
//! the surface keywords from PLAN §2 (`hype`, `house`, `purr`, `hiss`,
//! `pounce`, `nap`, `crosses above/below`) and emits `KW_*` tokens for them.
//!
//! Stub today; first token kinds + scanner state machine land as M1
//! implementation arrives.
