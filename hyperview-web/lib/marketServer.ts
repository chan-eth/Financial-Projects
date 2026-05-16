// Server-side market-data helper.
//
// Two upstream modes:
//
//   1. HYPERVIEW_API set → call the hyperview-worker's /market/* endpoints
//      (production path; injects authorization + per-user rate limits).
//
//   2. HYPERVIEW_API unset → fall back to talking to Hyperliquid directly
//      from the server. Useful for M0 demos before the worker is deployed.
//
// The fallback bypasses the worker's rate limit and auth — strictly a dev /
// staging convenience. Production deployments MUST set HYPERVIEW_API.

import { MarketBar, type MarketBar as TMarketBar } from "./schemas";

const HYPERVIEW_API = process.env.HYPERVIEW_API ?? null;
const HYPERLIQUID_FALLBACK = "https://api.hyperliquid-testnet.xyz";

const TF_TO_INTERVAL: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

export interface CandlesQuery {
  symbol: string;
  tf: string;
  startMs: number;
  endMs: number;
}

export async function fetchCandles(q: CandlesQuery): Promise<TMarketBar[]> {
  if (HYPERVIEW_API) {
    return fetchFromWorker(q);
  }
  return fetchFromHyperliquidDirect(q);
}

async function fetchFromWorker(q: CandlesQuery): Promise<TMarketBar[]> {
  const params = new URLSearchParams({
    symbol: q.symbol,
    tf: q.tf,
    startMs: String(q.startMs),
    endMs: String(q.endMs),
  });
  const res = await fetch(`${HYPERVIEW_API}/market/candles?${params.toString()}`, {
    headers: { accept: "application/json" },
    // Workers' cache layer handles repeats; do not cache here.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`hyperview-worker /market/candles ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { bars?: unknown };
  return MarketBar.array().parse(body.bars ?? []);
}

async function fetchFromHyperliquidDirect(q: CandlesQuery): Promise<TMarketBar[]> {
  const interval = TF_TO_INTERVAL[q.tf];
  if (!interval) throw new Error(`unsupported timeframe: ${q.tf}`);
  const res = await fetch(`${HYPERLIQUID_FALLBACK}/info`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: { coin: q.symbol, interval, startTime: q.startMs, endTime: q.endMs },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`hyperliquid /info ${res.status}: ${await res.text()}`);
  }
  const raw = (await res.json()) as Array<{
    t: number; o: string | number; h: string | number;
    l: string | number; c: string | number; v: string | number;
  }>;
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    ts: Math.floor(r.t / 1000),
    open: Number(r.o),
    high: Number(r.h),
    low: Number(r.l),
    close: Number(r.c),
    volume: Number(r.v),
  }));
}
