import {
  HYPERLIQUID_FEES,
  computeRunMetrics,
  hyperliquidBaseline,
  kalshi15mBaseline,
  monthlyReturns,
  rollingSharpe,
  periodsPerYearFromTimeframe,
  runEngine,
} from "@bt/engine";
import { R2_PREFIX, jsonlDecode, jsonlEncode, ymKey } from "@bt/data/r2-parquet";
import type { Bar, KalshiBarEvent } from "@bt/engine";
import type { EquityPoint, RunMetrics, TearsheetPayload, Trade } from "@bt/schemas";
import type { Env, JobMessage } from "./env.js";
import { getRun, markRunStatus } from "./repo/runs.js";
import { insertTrades } from "./repo/trades.js";
import { insertEquityDownsampled } from "./repo/equity.js";

export async function processJob(msg: JobMessage, env: Env): Promise<void> {
  if (msg.kind === "run-backtest") {
    await runBacktest(env, msg.runId);
    return;
  }
  if (msg.kind === "ingest") {
    // Phase 1 ingest is CLI-driven; this is reserved for the Phase 2 cron path.
    console.warn(`ingest job received but not implemented in Phase 1: ${msg.venue}`);
    return;
  }
}

async function runBacktest(env: Env, runId: string): Promise<void> {
  const run = await getRun(env.DB, runId);
  if (run == null) throw new Error(`run ${runId} not found`);

  await markRunStatus(env.DB, runId, "running", { startedAt: new Date().toISOString() });

  const cfg = run.configJson;
  const isKalshi = cfg.strategy.kind === "kalshi_15m";

  if (isKalshi) {
    const bars = streamKalshiEvents(env, run.symbolId, cfg.startTs, cfg.endTs);
    const strat = kalshi15mBaseline(cfg.strategy);
    const result = await runEngine<KalshiBarEvent>({
      runId,
      bars,
      strategy: strat,
      fees: { takerBps: 0, makerBps: 0, slippageBps: 0 },
      initialCashUsd: cfg.initialCashUsd,
      checkpointEveryNBars: 2_000,
      onCheckpoint: (cp) =>
        env.DATA.put(R2_PREFIX.runCheckpoint(runId, cp.cursorTs), JSON.stringify(cp)),
    });
    await persistResult(env, runId, cfg.timeframe, cfg.startTs, cfg.endTs, cfg.initialCashUsd, result.equity, result.trades);
    return;
  }

  const bars = streamHyperliquidBars(env, cfg.symbol, cfg.timeframe, cfg.startTs, cfg.endTs);
  const strat = hyperliquidBaseline(cfg.strategy);
  const result = await runEngine<Bar>({
    runId,
    bars,
    strategy: strat,
    fees: HYPERLIQUID_FEES,
    initialCashUsd: cfg.initialCashUsd,
    checkpointEveryNBars: 5_000,
    onCheckpoint: (cp) =>
      env.DATA.put(R2_PREFIX.runCheckpoint(runId, cp.cursorTs), JSON.stringify(cp)),
  });
  await persistResult(env, runId, cfg.timeframe, cfg.startTs, cfg.endTs, cfg.initialCashUsd, result.equity, result.trades);
}

async function persistResult(
  env: Env,
  runId: string,
  timeframe: string,
  startTs: number,
  endTs: number,
  initialCashUsd: number,
  equity: ReadonlyArray<EquityPoint>,
  trades: ReadonlyArray<Trade>,
): Promise<void> {
  const metrics: RunMetrics = computeRunMetrics({ equity, trades, startTs, endTs, timeframe, initialCashUsd });

  await env.DATA.put(R2_PREFIX.runEquity(runId), jsonlEncode(equity));
  await env.DATA.put(R2_PREFIX.runTrades(runId), jsonlEncode(trades));

  const tearsheet: TearsheetPayload = {
    runId,
    metrics,
    equity: equity.map((p) => ({ ts: p.ts, equity: p.equity, drawdown: p.drawdown })),
    rollingSharpe: rollingSharpe(equity, 30, periodsPerYearFromTimeframe(timeframe)),
    monthlyReturns: monthlyReturns(equity),
    perSymbol: [],
    generatedAt: new Date().toISOString(),
  };
  await env.DATA.put(R2_PREFIX.runTearsheet(runId), JSON.stringify(tearsheet));

  await insertEquityDownsampled(env.DB, runId, equity);
  await insertTrades(env.DB, trades);
  await markRunStatus(env.DB, runId, "succeeded", {
    finishedAt: new Date().toISOString(),
    metrics,
  });
}

async function* streamHyperliquidBars(
  env: Env,
  symbol: string,
  timeframe: string,
  startTs: number,
  endTs: number,
): AsyncGenerator<Bar> {
  for (const ym of yearMonthsBetween(startTs, endTs)) {
    const key = R2_PREFIX.bars("hyperliquid", symbol, timeframe, ym);
    const obj = await env.DATA.get(key);
    if (obj == null) continue;
    const text = await obj.text();
    for (const bar of jsonlDecode<Bar>(text)) {
      if (bar.ts < startTs || bar.ts > endTs) continue;
      yield bar;
    }
  }
}

async function* streamKalshiEvents(
  env: Env,
  symbolId: string,
  startTs: number,
  endTs: number,
): AsyncGenerator<KalshiBarEvent> {
  void env;
  void symbolId;
  void startTs;
  void endTs;
  // Phase 1: implemented in scripts/seed-demo-run.ts which pre-populates R2.
  // Worker streaming reads from R2 keys produced by ingest-kalshi + ingest-brti.
  // Stubbed here to keep the consumer cross-compilable; wire concrete reader in
  // the same shape as streamHyperliquidBars once ingest CLIs have run.
  return;
}

function yearMonthsBetween(startTs: number, endTs: number): string[] {
  const out: string[] = [];
  const cur = new Date(startTs * 1000);
  cur.setUTCDate(1);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(endTs * 1000);
  while (cur.getTime() / 1000 <= end.getTime() / 1000) {
    out.push(ymKey(Math.floor(cur.getTime() / 1000)));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}
