-- 0017_hv_order_intent.sql — record of client-signed order payloads forwarded
-- to Hyperliquid, with reconciliation against the venue's fills. Per PLAN §3.
-- Private keys never reach the worker; payload_hash binds the row to the exact
-- signed bytes for audit. idempotency_key dedupes client retries.

CREATE TABLE IF NOT EXISTS hv_order_intent (
  intent_id         TEXT PRIMARY KEY,                                 -- ULID we mint
  user_id           TEXT NOT NULL REFERENCES hv_user(user_id) ON DELETE CASCADE,
  subaccount_id     TEXT REFERENCES hv_subaccount(subaccount_id) ON DELETE SET NULL,
  symbol            TEXT NOT NULL,
  side              TEXT NOT NULL CHECK (side IN ('long','short','close_long','close_short')),
  qty               TEXT NOT NULL,                                    -- string-encoded decimal (no float)
  limit_price       TEXT,                                             -- NULL = market
  payload_hash      TEXT NOT NULL,                                    -- sha-256(canonicalized signed payload)
  idempotency_key   TEXT NOT NULL,
  hl_oid            TEXT,                                             -- Hyperliquid order id once accepted
  status            TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('submitted','accepted','rejected','filled','partial','canceled','expired')),
  reject_reason     TEXT,
  filled_qty        TEXT NOT NULL DEFAULT '0',
  avg_fill_price    TEXT,
  fee_paid          TEXT,
  submitted_at      INTEGER NOT NULL,                                 -- unix seconds
  last_updated_at   INTEGER NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS hv_order_intent_by_user_submitted
  ON hv_order_intent(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS hv_order_intent_by_status_submitted
  ON hv_order_intent(status, submitted_at DESC) WHERE status IN ('submitted','accepted','partial');
