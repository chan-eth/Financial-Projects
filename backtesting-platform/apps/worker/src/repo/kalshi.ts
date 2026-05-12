import type { KalshiSnapshot } from "@bt/schemas";

export async function insertKalshiSnapshots(
  db: D1Database,
  snapshots: ReadonlyArray<KalshiSnapshot>,
): Promise<void> {
  if (snapshots.length === 0) return;
  const stmts = snapshots.map((s) =>
    db
      .prepare(
        `INSERT INTO kalshi_snapshots
           (id, market_ticker, ts, yes_bid, yes_ask, no_bid, no_ask, volume, underlying_index_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        s.id,
        s.marketTicker,
        s.ts,
        s.yesBid,
        s.yesAsk,
        s.noBid,
        s.noAsk,
        s.volume,
        s.underlyingIndexPrice,
      ),
  );
  await db.batch(stmts);
}
