import type { TradeSide } from "@bt/schemas";

export interface Bar {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KalshiBookSnapshot {
  ts: number;
  marketTicker: string;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
}

export interface KalshiBarEvent {
  bar: Bar;
  marketTicker: string;
  book: KalshiBookSnapshot | null;
  strike: number;
  closeTs: number;
}

export interface Order {
  side: TradeSide;
  qty: number;
  limitPrice?: number;
  reason?: string;
}

export interface Fill {
  ts: number;
  side: TradeSide;
  qty: number;
  price: number;
  fee: number;
  reason?: string;
}

export interface StrategyContext {
  readonly equity: number;
  readonly position: number;
  readonly avgEntry: number;
  readonly cash: number;
  readonly history: ReadonlyArray<number>;
}

export interface Strategy<E = Bar> {
  readonly name: string;
  onBar(event: E, ctx: StrategyContext): Order[];
}

export interface VenueFees {
  takerBps: number;
  makerBps: number;
  slippageBps: number;
}

export interface EngineCheckpoint {
  cursorTs: number;
  cash: number;
  position: number;
  avgEntry: number;
  highWaterMark: number;
  history: number[];
}
