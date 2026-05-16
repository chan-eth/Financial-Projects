-- 0014_hv_script.sql — HypeScript scripts (source + compiled bytecode).
-- Source and bytecode live in R2 keyed by (script_id, version) so D1 stays
-- metadata-only per the existing platform's rules. Manifest is small enough
-- to inline as JSON for filtering without an R2 fetch.

CREATE TABLE IF NOT EXISTS hv_script (
  script_id        TEXT NOT NULL,                                     -- ULID
  version          INTEGER NOT NULL DEFAULT 1,                        -- bumped on publish; immutable per version
  author_user_id   TEXT NOT NULL REFERENCES hv_user(user_id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('indicator','strategy','screener')),
  visibility       TEXT NOT NULL DEFAULT 'private'
                    CHECK (visibility IN ('private','unlisted','public')),
  badge            TEXT NOT NULL DEFAULT 'unverified'
                    CHECK (badge IN ('unverified','verified','quarantined')),
  source_r2_key    TEXT NOT NULL,                                     -- scripts/<id>/<version>/source.hype
  bytecode_r2_key  TEXT NOT NULL,                                     -- scripts/<id>/<version>/bytecode.hvb
  manifest_json    TEXT NOT NULL,                                     -- {uses:[], emits:[], params:{}}
  bytecode_size    INTEGER NOT NULL,                                  -- bytes
  compiler_version TEXT NOT NULL,                                     -- "hypec 0.0.0-m1"
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (script_id, version)
);
CREATE INDEX IF NOT EXISTS hv_script_by_author ON hv_script(author_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hv_script_by_public ON hv_script(visibility, badge, created_at DESC)
  WHERE visibility = 'public';
