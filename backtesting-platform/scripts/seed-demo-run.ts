#!/usr/bin/env tsx
/**
 * End-to-end demo: synthesize 70 days of 1h bars, run the Hyperliquid baseline
 * strategy through the shared engine, persist a tearsheet payload to local R2,
 * and print the metrics. Use this to validate the engine + UI without needing
 * the full Worker / D1 / remote R2 stack online.
 *
 *   pnpm tsx scripts/seed-demo-run.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  HYPERLIQUID_FEES,
  computeRunMetrics,
  hyperliquidBaseline,
  monthlyReturns,
  periodsPerYearFromTimeframe,
  rollingSharpe,
  runEngine,
} from "../packages/engine/src/index.js";
import type { Bar } from "../packages/engine/src/types.js";
import type { TearsheetPayload } from "../packages/schemas/src/index.js";
import { R2_PREFIX, jsonlEncode } from "../packages/data/src/r2-parquet.js";
import { LocalR2 } from "./_r2-local.js";

const SEC_PER_HOUR = 3600;
const HOURS = 70 * 24;
const TF = "1h";
const SYMBOL = "BTC";

function* syntheticBars(): Generator<Bar> {
  let price = 65_000;
  const start = Math.floor(Date.now() / 1000) - HOURS * SEC_PER_HOUR;
  let trend = 1;
  for (let i = 0; i < HOURS; i++) {
    if (i % 240 === 0) trend = -trend;
    const drift = trend * 0.0008;
    const vol = 0.005;
    const r = drift + (Math.random() - 0.5) * vol;
    const open = price;
    const close = price * (1 + r);
    const high = Math.max(open, close) * (1 + Math.random() * 0.001);
    const low = Math.min(open, close) * (1 - Math.random() * 0.001);
    yield { ts: start + i * SEC_PER_HOUR, open, high, low, close, volume: 100 + Math.random() * 50 };
    price = close;
  }
}

async function asyncFrom<T>(gen: Iterable<T>): Promise<AsyncIterable<T>> {
  async function* it() {
    for (const x of gen) yield x;
  }
  return it();
}

async function main() {
  const runId = `demo-${Date.now().toString(36)}`;
  console.error(`seeding demo run ${runId}`);

  const bars = await asyncFrom(syntheticBars());
  const strategy = hyperliquidBaseline({
    kind: "hyperliquid",
    symbol: SYMBOL,
    timeframe: TF,
    fastEma: 12,
    slowEma: 48,
    riskPerTradeBps: 50,
    takerFeeBps: 4,
    makerFeeBps: 1,
    slippageBps: 2,
  });

  const result = await runEngine<Bar>({
    runId,
    bars,
    strategy,
    fees: HYPERLIQUID_FEES,
    initialCashUsd: 100_000,
  });

  const startTs = result.equity[0]?.ts ?? 0;
  const endTs = result.equity[result.equity.length - 1]?.ts ?? 0;

  const metrics = computeRunMetrics({
    equity: result.equity,
    trades: result.trades,
    startTs,
    endTs,
    timeframe: TF,
    initialCashUsd: 100_000,
  });

  const tearsheet: TearsheetPayload = {
    runId,
    metrics,
    equity: result.equity.map((p) => ({ ts: p.ts, equity: p.equity, drawdown: p.drawdown })),
    rollingSharpe: rollingSharpe(result.equity, 30, periodsPerYearFromTimeframe(TF)),
    monthlyReturns: monthlyReturns(result.equity),
    perSymbol: [],
    generatedAt: new Date().toISOString(),
  };

  const r2 = new LocalR2();
  await r2.put(R2_PREFIX.runEquity(runId), jsonlEncode(result.equity));
  await r2.put(R2_PREFIX.runTrades(runId), jsonlEncode(result.trades));
  await r2.put(R2_PREFIX.runTearsheet(runId), JSON.stringify(tearsheet, null, 2));

  const summary = {
    runId,
    bars: HOURS,
    trades: result.trades.length,
    metrics,
  };
  const outPath = `.local-r2/${R2_PREFIX.runTearsheet(runId)}`;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile("demo-summary.json", JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
