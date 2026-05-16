-- 0012_hv_watchlist.sql — user-curated symbol watchlists.

CREATE TABLE IF NOT EXISTS hv_watchlist (
  user_id     TEXT NOT NULL REFERENCES hv_user(user_id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,                                          -- matches SymbolString regex from @bt/schemas
  position    INTEGER NOT NULL DEFAULT 0,                             -- display order (smaller first)
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, symbol)
);
CREATE INDEX IF NOT EXISTS hv_watchlist_by_user_position
  ON hv_watchlist(user_id, pinned DESC, position);
