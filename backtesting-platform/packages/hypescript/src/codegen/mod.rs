//! Code generator — lowers IR to .hvb bytecode per PLAN §12.4.
//!
//! .hvb container layout:
//!   0   4   magic "HVB\0"
//!   4   1   version (= 1)
//!   5   1   flags (bit0 strategy, bit1 indicator, bit2 screener)
//!   6   2   manifest_len
//!   8   M   manifest (CBOR: uses, emits, params, source_name)
//!   …   2   const_pool_count + entries
//!   …   4   fn_table_count + entries (name_idx, code_offset, code_len, lookback)
//!   …   4   code_section_len + raw bytecode
//!   …  32   blake3 hash of all preceding bytes (integrity + cache key)
//!
//! Stub today.
