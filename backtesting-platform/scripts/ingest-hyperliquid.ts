#!/usr/bin/env tsx
import { HyperliquidClient } from "../packages/data/src/hyperliquid.js";
import { R2_PREFIX, jsonlEncode, ymKey } from "../packages/data/src/r2-parquet.js";
import { getNumber, getString, parseArgs } from "./_args.js";
import { LocalR2 } from "./_r2-local.js";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type TF = (typeof TIMEFRAMES)[number];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const days = Math.min(70, getNumber(args, "days", 70));
  const symbol = getString(args, "symbol", "BTC");
  const timeframe = getString(args, "timeframe", "1h") as TF;
  if (!TIMEFRAMES.includes(timeframe)) {
    throw new Error(`bad --timeframe ${timeframe}`);
  }

  const endMs = Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;
  const client = new HyperliquidClient();
  console.error(`hyperliquid ingest ${symbol} ${timeframe} ${days}d`);

  const bars = await client.candles({ coin: symbol, timeframe, startMs, endMs });
  console.error(`  fetched ${bars.length} bars`);
  if (bars.length === 0) return;

  const r2 = new LocalR2();
  const byMonth = new Map<string, typeof bars>();
  for (const b of bars) {
    const ym = ymKey(b.ts);
    const arr = byMonth.get(ym) ?? [];
    arr.push(b);
    byMonth.set(ym, arr);
  }
  for (const [ym, arr] of byMonth) {
    const key = R2_PREFIX.bars("hyperliquid", symbol, timeframe, ym);
    await r2.put(key, jsonlEncode(arr));
    console.error(`  wrote ${key} (${arr.length} rows)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
