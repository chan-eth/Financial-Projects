-- 0013_hv_alert.sql — user alerts wired to a HypeScript signal source.
-- An alert is "fire a notification when the script emits a purr/hiss matching
-- this filter." Evaluation runs edge-side inside the streaming Durable Object
-- per PLAN §3 (M2 wires the DO; this table is the contract).

CREATE TABLE IF NOT EXISTS hv_alert (
  alert_id        TEXT PRIMARY KEY,                                   -- ULID
  user_id         TEXT NOT NULL REFERENCES hv_user(user_id) ON DELETE CASCADE,
  script_id       TEXT REFERENCES hv_script(script_id) ON DELETE SET NULL,
  symbol          TEXT NOT NULL,
  timeframe       TEXT NOT NULL CHECK (timeframe IN ('1m','5m','15m','1h','4h','1d')),
  signal_filter   TEXT NOT NULL DEFAULT 'any'
                   CHECK (signal_filter IN ('any','purr','hiss')),
  tag_filter      TEXT,                                               -- optional substring match on signal.tag
  state           TEXT NOT NULL DEFAULT 'armed'
                   CHECK (state IN ('armed','triggered','paused','disabled')),
  last_fired_at   TEXT,
  fire_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS hv_alert_by_user_state ON hv_alert(user_id, state);
CREATE INDEX IF NOT EXISTS hv_alert_by_symbol_state ON hv_alert(symbol, state) WHERE state = 'armed';
