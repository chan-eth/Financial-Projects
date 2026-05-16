-- 0016_hv_ad_impression.sql — ad-impression telemetry.
-- Raw rows kept ≤14 days (cleanup runs as a scheduled task). Hourly
-- aggregates roll into hv_ad_impression_hourly for long-term metrics in R2.
-- Per PLAN §3 — D1 stays metadata-only.

CREATE TABLE IF NOT EXISTS hv_ad_impression (
  impression_id   TEXT PRIMARY KEY,                                   -- ULID
  user_id         TEXT REFERENCES hv_user(user_id) ON DELETE SET NULL, -- NULL for logged-out impressions
  placement       TEXT NOT NULL                                       -- chart-bottom, watchlist-inline, scriptshop-banner, cold-start-interstitial
                   CHECK (placement IN ('chart_bottom','watchlist_inline','scriptshop_banner','cold_start_interstitial')),
  network         TEXT NOT NULL CHECK (network IN ('admob','gam','house')),
  surface         TEXT NOT NULL CHECK (surface IN ('web','ios','android')),
  filled          INTEGER NOT NULL CHECK (filled IN (0,1)),
  revenue_micros  INTEGER,                                            -- USD * 1e6, if reported by network
  served_at       INTEGER NOT NULL                                    -- unix seconds
);
CREATE INDEX IF NOT EXISTS hv_ad_impression_by_served_at ON hv_ad_impression(served_at);

CREATE TABLE IF NOT EXISTS hv_ad_impression_hourly (
  hour_start      INTEGER NOT NULL,                                   -- unix seconds, truncated to hour
  placement       TEXT NOT NULL,
  network         TEXT NOT NULL,
  surface         TEXT NOT NULL,
  impressions     INTEGER NOT NULL DEFAULT 0,
  fills           INTEGER NOT NULL DEFAULT 0,
  revenue_micros  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hour_start, placement, network, surface)
);
