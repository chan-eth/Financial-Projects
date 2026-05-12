-- 0001_init.sql — initial schema for the backtesting platform.
-- D1 holds metadata + aggregates only. Series data (raw OHLCV, full equity
-- curves, L2 frames) lives in R2 keyed by run_id or (venue, symbol, tf, yyyy-mm).

CREATE TABLE IF NOT EXISTS strategies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('hyperliquid', 'kalshi_15m')),
  params_json TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS symbols (
  id         TEXT PRIMARY KEY,
  venue      TEXT NOT NULL,
  symbol     TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('perp', 'spot', 'kalshi_market')),
  base_index TEXT,
  meta_json  TEXT,
  UNIQUE (venue, symbol)
);

CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  strategy_id  TEXT NOT NULL REFERENCES strategies(id),
  symbol_id    TEXT NOT NULL REFERENCES symbols(id),
  timeframe    TEXT NOT NULL,
  start_ts     INTEGER NOT NULL,
  end_ts       INTEGER NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','canceled')),
  started_at   TEXT,
  finished_at  TEXT,
  config_json  TEXT NOT NULL,
  metrics_json TEXT
);
CREATE INDEX IF NOT EXISTS runs_by_status ON runs(status, finished_at DESC);
CREATE INDEX IF NOT EXISTS runs_by_strategy ON runs(strategy_id, finished_at DESC);

CREATE TABLE IF NOT EXISTS trades (
  id      TEXT PRIMARY KEY,
  run_id  TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ts      INTEGER NOT NULL,
  side    TEXT NOT NULL CHECK (side IN ('long','short','yes','no','close')),
  qty     REAL NOT NULL,
  price   REAL NOT NULL,
  fee     REAL NOT NULL,
  pnl     REAL NOT NULL,
  reason  TEXT
);
CREATE INDEX IF NOT EXISTS trades_by_run_ts ON trades(run_id, ts);

CREATE TABLE IF NOT EXISTS equity_points (
  run_id   TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ts       INTEGER NOT NULL,
  equity   REAL NOT NULL,
  drawdown REAL NOT NULL,
  PRIMARY KEY (run_id, ts)
);

CREATE TABLE IF NOT EXISTS kalshi_snapshots (
  id                       TEXT PRIMARY KEY,
  market_ticker            TEXT NOT NULL,
  ts                       INTEGER NOT NULL,
  yes_bid                  INTEGER NOT NULL,
  yes_ask                  INTEGER NOT NULL,
  no_bid                   INTEGER NOT NULL,
  no_ask                   INTEGER NOT NULL,
  volume                   INTEGER NOT NULL,
  underlying_index_price   REAL
);
CREATE INDEX IF NOT EXISTS kalshi_snapshots_by_ticker_ts ON kalshi_snapshots(market_ticker, ts);
