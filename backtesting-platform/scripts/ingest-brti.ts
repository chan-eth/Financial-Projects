#!/usr/bin/env tsx
import { CfBenchmarksClient, type CfbIndex } from "../packages/data/src/cfbenchmarks.js";
import { R2_PREFIX, jsonlEncode, ymKey } from "../packages/data/src/r2-parquet.js";
import { getNumber, getString, parseArgs } from "./_args.js";
import { LocalR2 } from "./_r2-local.js";

const INDICES: CfbIndex[] = ["BRTI", "ETHUSD_RTI", "SOLUSD_RTI", "DOGEUSD_RTI"];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const days = Math.min(70, getNumber(args, "days", 70));
  const only = getString(args, "index", "ALL");

  const token = process.env.CFBENCHMARKS_TOKEN ?? null;
  if (token == null) {
    console.error("warn: CFBENCHMARKS_TOKEN not set — falling back to public endpoint where available.");
    console.error("  if any index is gated, run scripts/reconstruct-index.ts for that asset (Phase 1.5).");
  }

  const client = new CfBenchmarksClient(token);
  const r2 = new LocalR2();
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - days * 24 * 60 * 60;

  const targets = only === "ALL" ? INDICES : (INDICES.includes(only as CfbIndex) ? [only as CfbIndex] : []);
  if (targets.length === 0) throw new Error(`bad --index ${only}`);

  for (const index of targets) {
    try {
      const bars = await client.history({ index, startTs, endTs });
      const byMonth = new Map<string, typeof bars>();
      for (const b of bars) {
        const ym = ymKey(b.ts);
        const arr = byMonth.get(ym) ?? [];
        arr.push(b);
        byMonth.set(ym, arr);
      }
      for (const [ym, arr] of byMonth) {
        await r2.put(R2_PREFIX.index(index, ym), jsonlEncode(arr));
      }
      console.error(`  ${index}: ${bars.length} bars across ${byMonth.size} months`);
    } catch (e) {
      console.error(`  ${index}: failed — ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
