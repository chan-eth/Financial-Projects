// @hv/schemas — Zod schemas shared by hyperview-web, hyperview-worker, and
// (via codegen) the native iOS + Android clients.
//
// Re-exports the upstream contracts from @bt/schemas (SymbolString, Timeframe,
// TradeSide) so HyperView never redefines a type that already exists in the
// platform. HyperView-specific schemas (market candle wire format, watchlist,
// alert, order intent) live below.

import { z } from "zod";

// ---- re-exports from @bt/schemas --------------------------------------------
export { SymbolString, Timeframe, TradeSide } from "@bt/schemas";
export type { Timeframe as TimeframeT, TradeSide as TradeSideT } from "@bt/schemas";

// ---- market data wire types -------------------------------------------------

/** OHLCV bar over the wire. Matches @bt/engine's Bar field-for-field; the
 *  worker emits exactly this shape from /market/candles. */
export const MarketBar = z.object({
  ts: z.number().int().nonnegative(), // unix seconds
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

export const HlUniverseAsset = z.object({
  name: z.string(),
  maxLeverage: z.number().int().positive(),
  szDecimals: z.number().int().nonnegative(),
});
export type HlUniverseAsset = z.infer<typeof HlUniverseAsset>;

export const MarketMetaResponse = z.object({
  universe: z.array(HlUniverseAsset),
});
export type MarketMetaResponse = z.infer<typeof MarketMetaResponse>;

// ---- watchlist --------------------------------------------------------------

export const WatchlistEntry = z.object({
  symbol: z.string().regex(/^[A-Z0-9._-]{1,32}$/),
  position: z.number().int().nonnegative(),
  pinned: z.boolean().default(false),
});
export type WatchlistEntry = z.infer<typeof WatchlistEntry>;

// ---- alert spec -------------------------------------------------------------

export const AlertSpec = z.object({
  scriptId: z.string().min(1).max(64).optional(),
  symbol: z.string().regex(/^[A-Z0-9._-]{1,32}$/),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]),
  signalFilter: z.enum(["any", "purr", "hiss"]).default("any"),
  tagFilter: z.string().max(64).optional(),
});
export type AlertSpec = z.infer<typeof AlertSpec>;

// ---- order intent (signed by the client; worker validates + forwards) -------

// Trading side is HyperView-specific (no Kalshi yes/no). Kept narrow on purpose.
export const HvOrderSide = z.enum(["long", "short", "close_long", "close_short"]);
export type HvOrderSide = z.infer<typeof HvOrderSide>;

/** Decimal-as-string so we never round-trip prices/sizes through f64.
 *  Format: optional minus, integer digits, optional fractional. No exponent. */
export const DecimalString = z.string().regex(/^-?[0-9]+(\.[0-9]+)?$/);
export type DecimalString = z.infer<typeof DecimalString>;

export const OrderIntent = z.object({
  symbol: z.string().regex(/^[A-Z0-9._-]{1,32}$/),
  side: HvOrderSide,
  qty: DecimalString,
  limitPrice: DecimalString.optional(),
  subaccountId: z.string().min(1).max(64).optional(),
  idempotencyKey: z.string().min(16).max(128),
  signedPayload: z.string(), // hex-encoded; worker never decodes, only forwards
  signedPayloadHash: z.string().regex(/^[a-f0-9]{64}$/), // sha-256, lowercase
});
export type OrderIntent = z.infer<typeof OrderIntent>;

export const SCHEMAS_VERSION = "0.0.1-m0";
