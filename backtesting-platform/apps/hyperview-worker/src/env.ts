export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  DATA: R2Bucket;
  HV_CHALLENGES: KVNamespace;
  RL_GLOBAL: RateLimiter;
  RL_ORDERS: RateLimiter;

  // Public config
  ALLOWED_ORIGINS: string;
  HYPERLIQUID_API_BASE: string;
  RATE_LIMIT_GLOBAL_PER_MIN: string;
  RATE_LIMIT_ORDERS_PER_MIN: string;
  RP_ID: string;       // hyperview.xyz | staging.hyperview.xyz | localhost
  RP_NAME?: string;    // defaults to "HyperView"
  RP_ORIGIN: string;   // https://hyperview.xyz | http://localhost:3000

  // Secrets — all set via `wrangler secret put <NAME> --env <env>`.
  // Present only when set; never logged.
  WORKER_INTERNAL_SECRET?: string;
  SESSION_SIGNING_SECRET?: string;  // HMAC key for JWT session tokens
  STRIPE_WEBHOOK_SECRET?: string;
  REVENUECAT_WEBHOOK_SECRET?: string;
}
