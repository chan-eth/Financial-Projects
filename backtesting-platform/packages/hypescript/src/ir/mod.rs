//! IR — typed SSA per PLAN §12.3. Operations follow the `OpKind` shape:
//!   Const, Binary/Unary, SeriesLoad{source, offset}, SeriesStream{stream},
//!   CallStdlib, EmitSignal{kind, cond, tag}, EmitOrder, Plot,
//!   CooldownGate{remaining}.
//!
//! Stub today.
