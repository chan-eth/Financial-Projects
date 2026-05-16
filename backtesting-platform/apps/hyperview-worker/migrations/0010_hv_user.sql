-- 0010_hv_user.sql — HyperView user accounts.
-- One row per user. The user is identified by their primary on-chain address
-- (their first registered passkey-derived secp256k1 key). Passkey credentials
-- live in their own table so a user can rotate or add additional credentials.
-- D1 holds metadata only; private keys never reach the worker.

CREATE TABLE IF NOT EXISTS hv_user (
  user_id           TEXT PRIMARY KEY,                                 -- ULID
  primary_address   TEXT NOT NULL UNIQUE,                             -- 0x...; first registered address
  display_name      TEXT,                                             -- optional, user-chosen
  entitlement_tier  TEXT NOT NULL DEFAULT 'free'
                     CHECK (entitlement_tier IN ('free','premium','team')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at      TEXT
);

CREATE TABLE IF NOT EXISTS hv_user_passkey (
  credential_id     TEXT PRIMARY KEY,                                 -- WebAuthn credential id, base64url
  user_id           TEXT NOT NULL REFERENCES hv_user(user_id) ON DELETE CASCADE,
  public_key_cose   BLOB NOT NULL,                                    -- COSE_Key, raw
  sign_count        INTEGER NOT NULL DEFAULT 0,                       -- replay-protection counter
  transports_json   TEXT,                                             -- '["usb","internal"]' etc.
  aaguid            TEXT,                                             -- authenticator AAGUID for telemetry
  device_label      TEXT,                                             -- user-supplied "MacBook Air"
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at      TEXT
);
CREATE INDEX IF NOT EXISTS hv_user_passkey_by_user ON hv_user_passkey(user_id);
