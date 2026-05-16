export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  DATA: R2Bucket;
  RL_GLOBAL: RateLimiter;
  RL_ORDERS: RateLimiter;

  // Public config
  ALLOWED_ORIGINS: string;
  HYPERLIQUID_API_BASE: string;
  RATE_LIMIT_GLOBAL_PER_MIN: string;
  RATE_LIMIT_ORDERS_PER_MIN: string;

  // Secrets — all set via `wrangler secret put <NAME> --env <env>`.
  // Present only when set; never logged.
  WORKER_INTERNAL_SECRET?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  REVENUECAT_WEBHOOK_SECRET?: string;
}
