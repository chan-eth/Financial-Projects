import type { Bar, Fill, Order, VenueFees } from "./types.js";

const BPS = 10_000;

export function simulate(
  orders: ReadonlyArray<Order>,
  bar: Bar,
  fees: VenueFees,
): Fill[] {
  const fills: Fill[] = [];
  for (const order of orders) {
    const dirSign = order.side === "long" || order.side === "yes" ? 1 : -1;
    const slip = bar.close * (fees.slippageBps / BPS) * dirSign;
    const price = (order.limitPrice ?? bar.close) + slip;
    const notional = Math.abs(order.qty) * price;
    const fee = notional * (fees.takerBps / BPS);
    fills.push({
      ts: bar.ts,
      side: order.side,
      qty: Math.abs(order.qty),
      price,
      fee,
      reason: order.reason,
    });
  }
  return fills;
}

export const HYPERLIQUID_FEES: VenueFees = {
  takerBps: 4,
  makerBps: 1,
  slippageBps: 2,
};

export function kalshiFee(qtyContracts: number, takerFeeCents: number): number {
  return Math.abs(qtyContracts) * (takerFeeCents / 100);
}
