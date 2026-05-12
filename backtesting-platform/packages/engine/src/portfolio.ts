import type { Bar, Fill } from "./types.js";

export class Portfolio {
  cash: number;
  position = 0;
  avgEntry = 0;
  realizedPnl = 0;
  highWaterMark: number;
  lastMark = 0;

  constructor(initialCashUsd: number) {
    this.cash = initialCashUsd;
    this.highWaterMark = initialCashUsd;
  }

  applyFill(fill: Fill): number {
    const signed = signedQty(fill);
    const tradePnl = this.applyToPosition(signed, fill.price);
    this.cash -= signed * fill.price;
    this.cash -= fill.fee;
    this.realizedPnl += tradePnl - fill.fee;
    return tradePnl - fill.fee;
  }

  mark(bar: Bar): void {
    this.lastMark = bar.close;
    if (this.equity > this.highWaterMark) this.highWaterMark = this.equity;
  }

  get equity(): number {
    return this.cash + this.position * this.lastMark;
  }

  get drawdownPct(): number {
    if (this.highWaterMark <= 0) return 0;
    return (this.equity - this.highWaterMark) / this.highWaterMark;
  }

  private applyToPosition(signedQty: number, price: number): number {
    const prevPos = this.position;
    const newPos = prevPos + signedQty;

    if (prevPos === 0 || Math.sign(prevPos) === Math.sign(signedQty)) {
      const totalCost = this.avgEntry * Math.abs(prevPos) + price * Math.abs(signedQty);
      this.avgEntry = totalCost / Math.abs(newPos || 1);
      this.position = newPos;
      return 0;
    }

    const closedQty = Math.min(Math.abs(prevPos), Math.abs(signedQty));
    const closedPnl = (price - this.avgEntry) * closedQty * Math.sign(prevPos);
    this.position = newPos;
    if (Math.sign(newPos) !== Math.sign(prevPos) && newPos !== 0) {
      this.avgEntry = price;
    } else if (newPos === 0) {
      this.avgEntry = 0;
    }
    return closedPnl;
  }
}

function signedQty(fill: Fill): number {
  switch (fill.side) {
    case "long":
    case "yes":
      return fill.qty;
    case "short":
    case "no":
      return -fill.qty;
    case "close":
      return 0;
  }
}
