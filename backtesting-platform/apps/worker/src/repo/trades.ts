import type { Trade } from "@bt/schemas";

const BATCH = 100;

export async function insertTrades(db: D1Database, trades: ReadonlyArray<Trade>): Promise<void> {
  for (let i = 0; i < trades.length; i += BATCH) {
    const chunk = trades.slice(i, i + BATCH);
    const stmts = chunk.map((t) =>
      db
        .prepare(
          `INSERT INTO trades (id, run_id, ts, side, qty, price, fee, pnl, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(t.id, t.runId, t.ts, t.side, t.qty, t.price, t.fee, t.pnl, t.reason),
    );
    await db.batch(stmts);
  }
}
