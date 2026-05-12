import type { HyperliquidStrategyParams } from "@bt/schemas";
import type { Bar, Order, Strategy, StrategyContext } from "../types.js";

function ema(prev: number | undefined, value: number, period: number): number {
  const k = 2 / (period + 1);
  return prev == null ? value : value * k + prev * (1 - k);
}

export function hyperliquidBaseline(params: HyperliquidStrategyParams): Strategy<Bar> {
  let fast: number | undefined;
  let slow: number | undefined;
  let lastSignal: 1 | -1 | 0 = 0;

  return {
    name: `hyperliquid-baseline(${params.fastEma}/${params.slowEma})`,
    onBar(bar: Bar, ctx: StrategyContext): Order[] {
      fast = ema(fast, bar.close, params.fastEma);
      slow = ema(slow, bar.close, params.slowEma);
      if (ctx.history.length < params.slowEma) return [];

      const signal: 1 | -1 | 0 = fast > slow ? 1 : fast < slow ? -1 : 0;
      if (signal === lastSignal) return [];
      lastSignal = signal;

      const orders: Order[] = [];
      if (ctx.position !== 0) {
        orders.push({
          side: ctx.position > 0 ? "short" : "long",
          qty: Math.abs(ctx.position),
          reason: "flip-flat",
        });
      }
      if (signal !== 0) {
        const risk = ctx.equity * (params.riskPerTradeBps / 10_000);
        const qty = risk / bar.close;
        orders.push({
          side: signal === 1 ? "long" : "short",
          qty,
          reason: signal === 1 ? "ema-cross-up" : "ema-cross-down",
        });
      }
      return orders;
    },
  };
}
