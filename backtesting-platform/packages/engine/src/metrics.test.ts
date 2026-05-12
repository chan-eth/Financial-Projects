import { describe, expect, test } from "vitest";
import {
  cagr,
  computeRunMetrics,
  maxDrawdown,
  mean,
  monthlyReturns,
  returns,
  rollingSharpe,
  sharpe,
  sortino,
  stddev,
  tradeStats,
} from "./metrics.js";
import type { EquityPoint, Trade } from "@bt/schemas";

describe("metrics primitives", () => {
  test("returns", () => {
    expect(returns([100, 110, 99])).toEqual([0.1, -0.1]);
  });

  test("mean/stddev on a known sample", () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(5, 10);
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138089935, 6);
  });

  test("sharpe = 0 when stddev is 0", () => {
    expect(sharpe([0.01, 0.01, 0.01], 252)).toBe(0);
  });

  test("sortino uses downside deviation", () => {
    const r = [0.02, -0.01, 0.03, -0.02];
    const s = sortino(r, 252);
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThan(0);
  });

  test("maxDrawdown picks deepest trough", () => {
    expect(maxDrawdown([100, 120, 90, 110, 60, 80])).toBeCloseTo((60 - 120) / 120, 10);
  });

  test("cagr over a year doubles → ~100%", () => {
    const SEC_YEAR = Math.floor(365.25 * 24 * 60 * 60);
    expect(cagr([100, 200], 0, SEC_YEAR)).toBeCloseTo(1, 6);
  });
});

describe("rollingSharpe", () => {
  test("returns one point per window over the rets series", () => {
    const points: EquityPoint[] = Array.from({ length: 40 }, (_, i) => ({
      runId: "t",
      ts: i * 60,
      equity: 100 * (1 + i * 0.001),
      drawdown: 0,
    }));
    const rs = rollingSharpe(points, 10, 252);
    expect(rs.length).toBe(39 - 10 + 1);
  });
});

describe("monthlyReturns", () => {
  test("buckets by UTC year/month", () => {
    const points: EquityPoint[] = [
      { runId: "t", ts: Date.UTC(2025, 0, 1) / 1000, equity: 100, drawdown: 0 },
      { runId: "t", ts: Date.UTC(2025, 0, 31) / 1000, equity: 110, drawdown: 0 },
      { runId: "t", ts: Date.UTC(2025, 1, 1) / 1000, equity: 110, drawdown: 0 },
      { runId: "t", ts: Date.UTC(2025, 1, 28) / 1000, equity: 99, drawdown: 0 },
    ];
    const m = monthlyReturns(points);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ year: 2025, month: 1 });
    expect(m[0]!.returnPct).toBeCloseTo(0.1, 6);
    expect(m[1]!.returnPct).toBeCloseTo(-0.1, 6);
  });
});

describe("tradeStats", () => {
  test("win rate + profit factor", () => {
    const trades: Trade[] = [
      { id: "1", runId: "t", ts: 0, side: "long", qty: 1, price: 100, fee: 0, pnl: 10, reason: null },
      { id: "2", runId: "t", ts: 0, side: "long", qty: 1, price: 100, fee: 0, pnl: -5, reason: null },
      { id: "3", runId: "t", ts: 0, side: "long", qty: 1, price: 100, fee: 0, pnl: 20, reason: null },
    ];
    const s = tradeStats(trades);
    expect(s.winRatePct).toBeCloseTo(2 / 3, 6);
    expect(s.profitFactor).toBeCloseTo(30 / 5, 6);
  });
});

describe("computeRunMetrics", () => {
  test("integrates end-to-end", () => {
    const SEC_YEAR = Math.floor(365.25 * 24 * 60 * 60);
    const equity: EquityPoint[] = [
      { runId: "t", ts: 0, equity: 100_000, drawdown: 0 },
      { runId: "t", ts: SEC_YEAR / 2, equity: 110_000, drawdown: 0 },
      { runId: "t", ts: SEC_YEAR, equity: 121_000, drawdown: 0 },
    ];
    const m = computeRunMetrics({
      equity,
      trades: [],
      startTs: 0,
      endTs: SEC_YEAR,
      timeframe: "1d",
      initialCashUsd: 100_000,
    });
    expect(m.totalReturnPct).toBeCloseTo(0.21, 6);
    expect(m.cagrPct).toBeCloseTo(0.21, 6);
    expect(m.tradeCount).toBe(0);
  });
});
