import type { EquityPoint } from "@bt/schemas";

const BATCH = 100;
const DOWNSAMPLE_TARGET = 1500;

export async function insertEquityDownsampled(
  db: D1Database,
  runId: string,
  points: ReadonlyArray<EquityPoint>,
): Promise<void> {
  const sampled = downsample(points, DOWNSAMPLE_TARGET);
  for (let i = 0; i < sampled.length; i += BATCH) {
    const chunk = sampled.slice(i, i + BATCH);
    const stmts = chunk.map((p) =>
      db
        .prepare(
          `INSERT OR REPLACE INTO equity_points (run_id, ts, equity, drawdown)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(runId, p.ts, p.equity, p.drawdown),
    );
    await db.batch(stmts);
  }
}

function downsample<T>(points: ReadonlyArray<T>, target: number): T[] {
  if (points.length <= target) return points.slice();
  const step = points.length / target;
  const out: T[] = [];
  for (let i = 0; i < target; i++) {
    const idx = Math.min(points.length - 1, Math.floor(i * step));
    out.push(points[idx]!);
  }
  return out;
}
