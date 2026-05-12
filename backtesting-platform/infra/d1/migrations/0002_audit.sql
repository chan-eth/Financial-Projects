-- 0002_audit.sql — audit + idempotency columns on runs.

ALTER TABLE runs ADD COLUMN created_by_ip TEXT;
ALTER TABLE runs ADD COLUMN created_by_email TEXT;
ALTER TABLE runs ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS runs_by_idempotency
  ON runs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
