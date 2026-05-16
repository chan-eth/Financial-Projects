-- 0015_hv_subscription.sql — premium subscription entitlement source-of-truth.
-- RevenueCat (iOS + Android IAP) and Stripe (web) both webhook into the
-- worker; this table is the canonical state. Server-side gates on premium
-- features query this. Per PLAN §6.

CREATE TABLE IF NOT EXISTS hv_subscription (
  subscription_id      TEXT PRIMARY KEY,                              -- ULID we mint
  user_id              TEXT NOT NULL REFERENCES hv_user(user_id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('stripe','revenuecat')),
  provider_customer_id TEXT,                                          -- stripe customer id / revenuecat app user id
  provider_sub_id      TEXT NOT NULL,                                 -- stripe subscription id / revenuecat subscription id
  product_id           TEXT NOT NULL,                                 -- "premium_monthly", "premium_annual"
  status               TEXT NOT NULL
                        CHECK (status IN ('trialing','active','past_due','canceled','expired','paused')),
  current_period_start INTEGER NOT NULL,                              -- unix seconds
  current_period_end   INTEGER NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0,1)),
  raw_event_json       TEXT,                                          -- most recent webhook payload for debug
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_sub_id)
);
CREATE INDEX IF NOT EXISTS hv_subscription_by_user_status ON hv_subscription(user_id, status);
CREATE INDEX IF NOT EXISTS hv_subscription_by_period_end ON hv_subscription(current_period_end, status)
  WHERE status IN ('active','trialing');
