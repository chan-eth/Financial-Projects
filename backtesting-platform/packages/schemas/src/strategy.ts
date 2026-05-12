import { z } from "zod";

export const StrategyKind = z.enum(["hyperliquid", "kalshi_15m"]);
export type StrategyKind = z.infer<typeof StrategyKind>;

export const Timeframe = z.enum([
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
]);
export type Timeframe = z.infer<typeof Timeframe>;

// Symbols are used as R2 path components (`data/<venue>/<symbol>/...`).
// Restrict to a safe character set so a malicious payload can't escape the
// namespace via `../` or whitespace.
export const SymbolString = z.string().regex(/^[A-Z0-9._-]+$/i).min(1).max(64);

export const HyperliquidStrategyParams = z.object({
  kind: z.literal("hyperliquid"),
  symbol: SymbolString,
  timeframe: Timeframe,
  fastEma: z.number().int().min(2).max(500).default(12),
  slowEma: z.number().int().min(5).max(1000).default(48),
  riskPerTradeBps: z.number().int().min(1).max(2000).default(50),
  takerFeeBps: z.number().int().min(0).max(100).default(4),
  makerFeeBps: z.number().int().min(-10).max(50).default(1),
  slippageBps: z.number().int().min(0).max(200).default(2),
});
export type HyperliquidStrategyParams = z.infer<typeof HyperliquidStrategyParams>;

export const Kalshi15mStrategyParams = z.object({
  kind: z.literal("kalshi_15m"),
  underlying: z.enum(["BTC", "ETH", "SOL", "DOGE", "HYPE"]),
  edgeBps: z.number().int().min(10).max(5000).default(150),
  maxConcurrent: z.number().int().min(1).max(20).default(3),
  takerFeeCentsPerContract: z.number().int().min(0).max(20).default(7),
  decisionLeadSec: z.number().int().min(0).max(900).default(60),
});
export type Kalshi15mStrategyParams = z.infer<typeof Kalshi15mStrategyParams>;

export const StrategyParams = z.discriminatedUnion("kind", [
  HyperliquidStrategyParams,
  Kalshi15mStrategyParams,
]);
export type StrategyParams = z.infer<typeof StrategyParams>;

export const Strategy = z.object({
  id: z.string(),
  name: z.string(),
  kind: StrategyKind,
  paramsJson: StrategyParams,
  createdAt: z.string().datetime(),
});
export type Strategy = z.infer<typeof Strategy>;
