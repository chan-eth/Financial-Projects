import { z } from "zod";
import { RunMetrics } from "./run.js";

export const TearsheetEquityPoint = z.object({
  ts: z.number().int(),
  equity: z.number(),
  drawdown: z.number(),
  benchmark: z.number().nullable().optional(),
});
export type TearsheetEquityPoint = z.infer<typeof TearsheetEquityPoint>;

export const MonthlyReturn = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  returnPct: z.number(),
});
export type MonthlyReturn = z.infer<typeof MonthlyReturn>;

export const RollingSharpePoint = z.object({
  ts: z.number().int(),
  sharpe: z.number(),
});
export type RollingSharpePoint = z.infer<typeof RollingSharpePoint>;

export const PerSymbolBreakdown = z.object({
  symbol: z.string(),
  trades: z.number().int(),
  pnl: z.number(),
  winRatePct: z.number(),
});
export type PerSymbolBreakdown = z.infer<typeof PerSymbolBreakdown>;

export const TearsheetPayload = z.object({
  runId: z.string(),
  metrics: RunMetrics,
  equity: z.array(TearsheetEquityPoint),
  rollingSharpe: z.array(RollingSharpePoint),
  monthlyReturns: z.array(MonthlyReturn),
  perSymbol: z.array(PerSymbolBreakdown),
  generatedAt: z.string().datetime(),
});
export type TearsheetPayload = z.infer<typeof TearsheetPayload>;
