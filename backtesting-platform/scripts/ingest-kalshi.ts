#!/usr/bin/env tsx
import { KalshiClient, KalshiRsaSigner } from "../packages/data/src/kalshi.js";
import { R2_PREFIX, jsonlEncode } from "../packages/data/src/r2-parquet.js";
import { getNumber, getString, parseArgs } from "./_args.js";
import { LocalR2 } from "./_r2-local.js";

const SERIES = ["KXBTC", "KXETH", "KXSOL", "KXDOGE", "KXHYPE"] as const;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const days = Math.min(70, getNumber(args, "days", 70));
  const series = getString(args, "series", "KXBTC") as (typeof SERIES)[number];
  if (!SERIES.includes(series)) throw new Error(`bad --series ${series}`);

  const keyId = process.env.KALSHI_API_KEY_ID;
  const pem = process.env.KALSHI_PRIVATE_KEY_PEM;
  const signer = keyId && pem ? await KalshiRsaSigner.fromPem(keyId, pem) : null;
  if (signer == null) {
    console.error("warn: KALSHI_API_KEY_ID / KALSHI_PRIVATE_KEY_PEM not set — using public read-only paths");
  }

  const client = new KalshiClient(signer);
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - days * 24 * 60 * 60;
  console.error(`kalshi ingest ${series} ${days}d`);

  const r2 = new LocalR2();
  let cursor: string | null = null;
  let total = 0;
  do {
    const page = await client.listMarkets({ eventTicker: undefined, status: "settled", limit: 200, cursor: cursor ?? undefined });
    const filtered = page.markets.filter((m) => m.series === series && m.openTs >= startTs && m.closeTs <= endTs);
    for (const m of filtered) {
      const candles = await client.candlesticks({
        ticker: m.ticker,
        startTs: m.openTs,
        endTs: m.closeTs,
        periodIntervalSec: 60,
      });
      const key = R2_PREFIX.kalshiCandles(m.ticker);
      await r2.put(key, jsonlEncode(candles));
      total += 1;
    }
    cursor = page.cursor;
  } while (cursor);

  console.error(`  ingested ${total} markets`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
