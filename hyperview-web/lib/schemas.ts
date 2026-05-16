// Inlined subset of @hv/schemas. Kept narrow on purpose — only the wire
// shapes the web app actually needs. If/when the schema drifts, regenerate
// from `backtesting-platform/packages/hv-schemas/src/index.ts` (single source
// of truth).

import { z } from "zod";

export const Timeframe = z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]);
export type Timeframe = z.infer<typeof Timeframe>;

export const MarketBar = z.object({
  ts: z.number().int().nonnegative(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().nonnegative(),
});
export type MarketBar = z.infer<typeof MarketBar>;

export const MarketCandlesResponse = z.object({
  bars: z.array(MarketBar),
});
export type MarketCandlesResponse = z.infer<typeof MarketCandlesResponse>;
