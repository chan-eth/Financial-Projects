import type { EquityPoint, Trade } from "@bt/schemas";
import { simulate } from "./execution.js";
import { Portfolio } from "./portfolio.js";
import type { Bar, EngineCheckpoint, KalshiBarEvent, Strategy, StrategyContext, VenueFees } from "./types.js";

export interface RunEngineArgs<E = Bar> {
  runId: string;
  bars: AsyncIterable<E>;
  strategy: Strategy<E>;
  fees: VenueFees;
  initialCashUsd: number;
  fromCheckpoint?: EngineCheckpoint;
  onCheckpoint?: (cp: EngineCheckpoint) => Promise<void> | void;
  checkpointEveryNBars?: number;
}

export interface RunEngineResult {
  equity: EquityPoint[];
  trades: Trade[];
  checkpoint: EngineCheckpoint;
}

export async function runEngine<E extends Bar | KalshiBarEvent>(
  args: RunEngineArgs<E>,
): Promise<RunEngineResult> {
  const pf = new Portfolio(args.fromCheckpoint?.cash ?? args.initialCashUsd);
  if (args.fromCheckpoint != null) {
    pf.cash = args.fromCheckpoint.cash;
    pf.position = args.fromCheckpoint.position;
    pf.avgEntry = args.fromCheckpoint.avgEntry;
    pf.highWaterMark = args.fromCheckpoint.highWaterMark;
  }

  const history: number[] = args.fromCheckpoint?.history.slice() ?? [];
  const equity: EquityPoint[] = [];
  const trades: Trade[] = [];
  let tradeSeq = 0;
  let barCount = 0;

  for await (const event of args.bars) {
    const bar = isKalshiEvent(event) ? event.bar : (event as Bar);
    const ctx: StrategyContext = {
      equity: pf.equity,
      position: pf.position,
      avgEntry: pf.avgEntry,
      cash: pf.cash,
      history,
    };
    const orders = args.strategy.onBar(event, ctx);
    const fills = simulate(orders, bar, args.fees);
    for (const fill of fills) {
      const pnlDelta = pf.applyFill(fill);
      tradeSeq += 1;
      trades.push({
        id: `${args.runId}:${tradeSeq}`,
        runId: args.runId,
        ts: fill.ts,
        side: fill.side,
        qty: fill.qty,
        price: fill.price,
        fee: fill.fee,
        pnl: pnlDelta,
        reason: fill.reason ?? null,
      });
    }
    pf.mark(bar);
    history.push(bar.close);
    equity.push({
      runId: args.runId,
      ts: bar.ts,
      equity: pf.equity,
      drawdown: pf.drawdownPct,
    });
    barCount += 1;
    if (
      args.checkpointEveryNBars != null &&
      args.onCheckpoint != null &&
      barCount % args.checkpointEveryNBars === 0
    ) {
      await args.onCheckpoint(snapshot(pf, history, bar.ts));
    }
  }

  const last = equity[equity.length - 1];
  const checkpoint = snapshot(pf, history, last?.ts ?? 0);
  return { equity, trades, checkpoint };
}

function isKalshiEvent(e: unknown): e is KalshiBarEvent {
  return typeof e === "object" && e != null && "bar" in e && "marketTicker" in e;
}

function snapshot(pf: Portfolio, history: number[], cursorTs: number): EngineCheckpoint {
  return {
    cursorTs,
    cash: pf.cash,
    position: pf.position,
    avgEntry: pf.avgEntry,
    highWaterMark: pf.highWaterMark,
    history: history.slice(-2048),
  };
}
