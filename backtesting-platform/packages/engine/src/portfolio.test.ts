import { describe, expect, test } from "vitest";
import { Portfolio } from "./portfolio.js";

describe("Portfolio", () => {
  test("long → short flip realizes PnL on the closed leg and opens the new leg at fill price", () => {
    // Buy 2 @ 100, mark at 110, then sell 3 @ 120: closes 2 long (+40) and
    // opens 1 short at 120. Cash math: +0 then -200 entry, then +360 from sell.
    const pf = new Portfolio(10_000);
    pf.applyFill({ ts: 0, side: "long", qty: 2, price: 100, fee: 0 });
    expect(pf.position).toBe(2);
    expect(pf.avgEntry).toBeCloseTo(100, 10);
    expect(pf.cash).toBeCloseTo(9_800, 10);

    pf.mark({ ts: 1, open: 110, high: 110, low: 110, close: 110, volume: 0 });
    expect(pf.equity).toBeCloseTo(9_800 + 2 * 110, 10);

    const realized = pf.applyFill({ ts: 2, side: "short", qty: 3, price: 120, fee: 0 });
    expect(realized).toBeCloseTo(40, 10); // (120 - 100) * 2
    expect(pf.position).toBe(-1);
    expect(pf.avgEntry).toBeCloseTo(120, 10);
    expect(pf.cash).toBeCloseTo(9_800 + 3 * 120, 10);
  });

  test("drawdown is computed against the running high-water mark", () => {
    const pf = new Portfolio(1_000);
    pf.mark({ ts: 0, open: 0, high: 0, low: 0, close: 0, volume: 0 });
    expect(pf.drawdownPct).toBe(0);

    pf.applyFill({ ts: 1, side: "long", qty: 10, price: 100, fee: 0 });
    pf.mark({ ts: 1, open: 110, high: 110, low: 110, close: 110, volume: 0 });
    const peak = pf.equity;
    expect(peak).toBeGreaterThan(1_000);

    pf.mark({ ts: 2, open: 80, high: 80, low: 80, close: 80, volume: 0 });
    expect(pf.drawdownPct).toBeCloseTo((pf.equity - peak) / peak, 10);
    expect(pf.drawdownPct).toBeLessThan(0);
  });
});
