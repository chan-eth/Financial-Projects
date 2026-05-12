import type { Kalshi15mStrategyParams } from "@bt/schemas";
import type { KalshiBarEvent, Order, Strategy, StrategyContext } from "../types.js";

const CENTS_PER_DOLLAR = 100;

export function kalshi15mBaseline(params: Kalshi15mStrategyParams): Strategy<KalshiBarEvent> {
  return {
    name: `kalshi-15m-baseline(${params.underlying})`,
    onBar(event: KalshiBarEvent, ctx: StrategyContext): Order[] {
      if (event.book == null) return [];
      if (ctx.position !== 0) return [];

      const indexPrice = event.bar.close;
      const strike = event.strike;
      const drift = (indexPrice - strike) / strike;
      const edge = Math.abs(drift) * 10_000;
      if (edge < params.edgeBps) return [];

      const buyYes = drift > 0;
      const askCents = buyYes ? event.book.yesAsk : event.book.noAsk;
      if (askCents <= 0 || askCents >= 99) return [];

      const maxNotional = ctx.equity / params.maxConcurrent;
      const perContractCost = askCents / CENTS_PER_DOLLAR;
      if (perContractCost <= 0) return [];
      const qty = Math.floor(maxNotional / perContractCost);
      if (qty <= 0) return [];

      return [
        {
          side: buyYes ? "yes" : "no",
          qty,
          limitPrice: perContractCost,
          reason: buyYes ? "drift-up" : "drift-down",
        },
      ];
    },
  };
}
