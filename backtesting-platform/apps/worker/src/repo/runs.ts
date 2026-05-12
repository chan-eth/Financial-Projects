import type { CreateRunRequest, Run, RunStatus } from "@bt/schemas";

export interface RunListItem {
  id: string;
  strategyKind: string;
  symbol: string;
  timeframe: string;
  status: RunStatus;
  totalReturnPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CreateRunAudit {
  ip: string | null;
  email: string | null;
  idempotencyKeyHash: string | null;
}

export async function createRun(
  db: D1Database,
  req: CreateRunRequest,
  audit: CreateRunAudit = { ip: null, email: null, idempotencyKeyHash: null },
): Promise<Run> {
  // Deterministic id when idempotency-key is provided so retries collapse.
  const id = audit.idempotencyKeyHash != null
    ? hashToUuid(audit.idempotencyKeyHash)
    : crypto.randomUUID();

  if (audit.idempotencyKeyHash != null) {
    const existing = await db
      .prepare(
        `SELECT id, strategy_id as strategyId, symbol_id as symbolId, timeframe,
                start_ts as startTs, end_ts as endTs, status, started_at as startedAt,
                finished_at as finishedAt, config_json as configJson, metrics_json as metricsJson
           FROM runs WHERE idempotency_key = ? LIMIT 1`,
      )
      .bind(audit.idempotencyKeyHash)
      .first<RawRun>();
    if (existing != null) {
      return {
        ...existing,
        configJson: JSON.parse(existing.configJson),
        metricsJson: existing.metricsJson ? JSON.parse(existing.metricsJson) : null,
      } as Run;
    }
  }

  const strategyId = await upsertStrategy(db, req.config.strategy);
  const symbolId = await upsertSymbol(db, req.config.symbol, req.config.strategy.kind);

  const row: Run = {
    id,
    strategyId,
    symbolId,
    timeframe: req.config.timeframe,
    startTs: req.config.startTs,
    endTs: req.config.endTs,
    status: "queued",
    startedAt: null,
    finishedAt: null,
    configJson: req.config,
    metricsJson: null,
  };

  await db
    .prepare(
      `INSERT INTO runs (id, strategy_id, symbol_id, timeframe, start_ts, end_ts, status,
                         config_json, created_by_ip, created_by_email, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.strategyId,
      row.symbolId,
      row.timeframe,
      row.startTs,
      row.endTs,
      row.status,
      JSON.stringify(row.configJson),
      audit.ip,
      audit.email,
      audit.idempotencyKeyHash,
    )
    .run();

  return row;
}

function hashToUuid(hex: string): string {
  // Take 32 hex chars (16 bytes) and shape as a UUID v4 string so it satisfies
  // the runId regex on the read path. Deterministic for the same idempotency key.
  const h = hex.replace(/-/g, "").slice(0, 32).padEnd(32, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export async function getRun(db: D1Database, id: string): Promise<Run | null> {
  const r = await db
    .prepare(
      `SELECT id, strategy_id as strategyId, symbol_id as symbolId, timeframe,
              start_ts as startTs, end_ts as endTs, status, started_at as startedAt,
              finished_at as finishedAt, config_json as configJson, metrics_json as metricsJson
         FROM runs WHERE id = ?`,
    )
    .bind(id)
    .first<RawRun>();
  if (r == null) return null;
  return {
    ...r,
    configJson: JSON.parse(r.configJson),
    metricsJson: r.metricsJson ? JSON.parse(r.metricsJson) : null,
  } as Run;
}

export async function listRuns(
  db: D1Database,
  opts: { limit: number; strategyKind?: string },
): Promise<RunListItem[]> {
  const where = opts.strategyKind ? "WHERE s.kind = ?" : "";
  const stmt = db.prepare(
    `SELECT r.id as id, s.kind as strategyKind, sym.symbol as symbol,
            r.timeframe as timeframe, r.status as status,
            json_extract(r.metrics_json, '$.totalReturnPct') as totalReturnPct,
            json_extract(r.metrics_json, '$.sharpe')         as sharpe,
            json_extract(r.metrics_json, '$.maxDrawdownPct') as maxDrawdownPct,
            r.started_at as startedAt, r.finished_at as finishedAt
       FROM runs r
       JOIN strategies s ON s.id = r.strategy_id
       JOIN symbols sym ON sym.id = r.symbol_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ?`,
  );
  const bound = opts.strategyKind ? stmt.bind(opts.strategyKind, opts.limit) : stmt.bind(opts.limit);
  const { results } = await bound.all<RunListItem>();
  return results;
}

export async function markRunStatus(
  db: D1Database,
  id: string,
  status: RunStatus,
  fields: { startedAt?: string; finishedAt?: string; metrics?: unknown } = {},
): Promise<void> {
  await db
    .prepare(
      `UPDATE runs
          SET status = ?,
              started_at = COALESCE(?, started_at),
              finished_at = COALESCE(?, finished_at),
              metrics_json = COALESCE(?, metrics_json)
        WHERE id = ?`,
    )
    .bind(
      status,
      fields.startedAt ?? null,
      fields.finishedAt ?? null,
      fields.metrics == null ? null : JSON.stringify(fields.metrics),
      id,
    )
    .run();
}

async function upsertStrategy(db: D1Database, params: { kind: string } & Record<string, unknown>): Promise<string> {
  const paramsJson = JSON.stringify(params);
  const existing = await db
    .prepare(`SELECT id FROM strategies WHERE params_json = ? LIMIT 1`)
    .bind(paramsJson)
    .first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db
    .prepare(`INSERT INTO strategies (id, name, kind, params_json) VALUES (?, ?, ?, ?)`)
    .bind(id, `${params.kind}-${id.slice(0, 8)}`, params.kind, paramsJson)
    .run();
  return id;
}

async function upsertSymbol(db: D1Database, symbol: string, kind: string): Promise<string> {
  const venue = kind === "kalshi_15m" ? "kalshi" : "hyperliquid";
  const existing = await db
    .prepare(`SELECT id FROM symbols WHERE venue = ? AND symbol = ? LIMIT 1`)
    .bind(venue, symbol)
    .first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db
    .prepare(`INSERT INTO symbols (id, venue, symbol, kind, base_index) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, venue, symbol, kind === "kalshi_15m" ? "kalshi_market" : "perp", baseIndexFor(symbol))
    .run();
  return id;
}

function baseIndexFor(symbol: string): string | null {
  if (symbol.startsWith("KXBTC")) return "BRTI";
  if (symbol.startsWith("KXETH")) return "ETHUSD_RTI";
  if (symbol.startsWith("KXSOL")) return "SOLUSD_RTI";
  if (symbol.startsWith("KXDOGE")) return "DOGEUSD_RTI";
  return null;
}

interface RawRun extends Omit<Run, "configJson" | "metricsJson"> {
  configJson: string;
  metricsJson: string | null;
}
