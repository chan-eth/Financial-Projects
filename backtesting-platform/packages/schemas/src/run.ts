import { z } from "zod";
import { StrategyParams, SymbolString, Timeframe } from "./strategy.js";

export const RunStatus = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const RunConfig = z
  .object({
    strategy: StrategyParams,
    symbol: SymbolString,
    timeframe: Timeframe,
    startTs: z.number().int(),
    endTs: z.number().int(),
    initialCashUsd: z.number().positive().default(100_000),
    benchmarkSymbol: SymbolString.optional(),
  })
  .refine((c) => c.startTs < c.endTs, {
    message: "startTs must be strictly less than endTs",
    path: ["endTs"],
  });
export type RunConfig = z.infer<typeof RunConfig>;

export const RunMetrics = z.object({
  totalReturnPct: z.number(),
  cagrPct: z.number(),
  sharpe: z.number(),
  sortino: z.number(),
  maxDrawdownPct: z.number(),
  calmar: z.number(),
  winRatePct: z.number(),
  profitFactor: z.number(),
  tradeCount: z.number().int(),
  avgWinPct: z.number(),
  avgLossPct: z.number(),
  exposurePct: z.number(),
});
export type RunMetrics = z.infer<typeof RunMetrics>;

export const Run = z.object({
  id: z.string(),
  strategyId: z.string(),
  symbolId: z.string(),
  timeframe: Timeframe,
  startTs: z.number().int(),
  endTs: z.number().int(),
  status: RunStatus,
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  configJson: RunConfig,
  metricsJson: RunMetrics.nullable(),
});
export type Run = z.infer<typeof Run>;

export const CreateRunRequest = z.object({
  config: RunConfig,
});
export type CreateRunRequest = z.infer<typeof CreateRunRequest>;

export const CreateRunResponse = z.object({
  runId: z.string(),
  status: RunStatus,
});
export type CreateRunResponse = z.infer<typeof CreateRunResponse>;
