export interface Env {
  DB: D1Database;
  DATA: R2Bucket;
  Q: Queue<JobMessage>;
  ALLOWED_ORIGIN: string;
  KALSHI_API_KEY_ID?: string;
  KALSHI_PRIVATE_KEY_PEM?: string;
  CFBENCHMARKS_TOKEN?: string;
  WORKER_INTERNAL_SECRET?: string;
}

export type JobMessage =
  | { kind: "run-backtest"; runId: string; chunkIndex: number }
  | { kind: "ingest"; venue: "hyperliquid" | "kalshi" | "brti"; days: number };
