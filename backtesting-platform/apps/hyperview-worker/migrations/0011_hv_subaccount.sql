-- 0011_hv_subaccount.sql — Hyperliquid sub-accounts per user.
-- A user starts with one "main" account (their primary_address). Sub-accounts
-- are created lazily on first trade after opt-in. UI calls them "Strategies"
-- (Strategy A, Strategy B) per PLAN §5.

CREATE TABLE IF NOT EXISTS hv_subaccount (
  subaccount_id      TEXT PRIMARY KEY,                                -- ULID
  user_id            TEXT NOT NULL REFERENCES hv_user(user_id) ON DELETE CASCADE,
  subaccount_address TEXT NOT NULL UNIQUE,                            -- 0x...; on-chain
  label              TEXT NOT NULL,                                   -- "Strategy A", "Long-term holds"
  is_main            INTEGER NOT NULL DEFAULT 0 CHECK (is_main IN (0,1)),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at        TEXT                                             -- soft-delete; archived sub-accounts hidden from UI
);
CREATE INDEX IF NOT EXISTS hv_subaccount_by_user ON hv_subaccount(user_id, archived_at);
CREATE UNIQUE INDEX IF NOT EXISTS hv_subaccount_one_main
  ON hv_subaccount(user_id) WHERE is_main = 1 AND archived_at IS NULL;
