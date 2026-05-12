import type { EquityPoint, MonthlyReturn, RollingSharpePoint, RunMetrics, Trade } from "@bt/schemas";

const SEC_PER_YEAR = 365.25 * 24 * 60 * 60;

export function returns(equity: ReadonlyArray<number>): number[] {
  const r: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1]!;
    const cur = equity[i]!;
    if (prev === 0) {
      r.push(0);
    } else {
      r.push((cur - prev) / prev);
    }
  }
  return r;
}

export function mean(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function stddev(xs: ReadonlyArray<number>): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

export function sharpe(rets: ReadonlyArray<number>, periodsPerYear: number): number {
  const sd = stddev(rets);
  if (sd === 0) return 0;
  return (mean(rets) / sd) * Math.sqrt(periodsPerYear);
}

export function sortino(rets: ReadonlyArray<number>, periodsPerYear: number): number {
  const downside = rets.filter((r) => r < 0);
  if (downside.length === 0) return 0;
  const dd = Math.sqrt(downside.reduce((s, r) => s + r * r, 0) / downside.length);
  if (dd === 0) return 0;
  return (mean(rets) / dd) * Math.sqrt(periodsPerYear);
}

export function maxDrawdown(equity: ReadonlyArray<number>): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    if (peak > 0) {
      const dd = (e - peak) / peak;
      if (dd < maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

export function cagr(equity: ReadonlyArray<number>, startTs: number, endTs: number): number {
  if (equity.length < 2) return 0;
  const first = equity[0]!;
  const last = equity[equity.length - 1]!;
  if (first <= 0) return 0;
  const years = (endTs - startTs) / SEC_PER_YEAR;
  if (years <= 0) return 0;
  return Math.pow(last / first, 1 / years) - 1;
}

export function rollingSharpe(
  points: ReadonlyArray<EquityPoint>,
  window: number,
  periodsPerYear: number,
): RollingSharpePoint[] {
  if (points.length < window + 1) return [];
  const rets = returns(points.map((p) => p.equity));
  const out: RollingSharpePoint[] = [];
  for (let i = window - 1; i < rets.length; i++) {
    const slice = rets.slice(i - window + 1, i + 1);
    out.push({ ts: points[i + 1]!.ts, sharpe: sharpe(slice, periodsPerYear) });
  }
  return out;
}

export function monthlyReturns(points: ReadonlyArray<EquityPoint>): MonthlyReturn[] {
  if (points.length === 0) return [];
  const buckets = new Map<string, { first: number; last: number; year: number; month: number }>();
  for (const p of points) {
    const d = new Date(p.ts * 1000);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const entry = buckets.get(key);
    if (entry == null) {
      buckets.set(key, { first: p.equity, last: p.equity, year, month });
    } else {
      entry.last = p.equity;
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((b) => ({
      year: b.year,
      month: b.month,
      returnPct: b.first === 0 ? 0 : (b.last - b.first) / b.first,
    }));
}

export function tradeStats(trades: ReadonlyArray<Trade>): {
  winRatePct: number;
  profitFactor: number;
  avgWinPct: number;
  avgLossPct: number;
} {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  return {
    winRatePct: trades.length === 0 ? 0 : wins.length / trades.length,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss,
    avgWinPct: wins.length === 0 ? 0 : grossWin / wins.length,
    avgLossPct: losses.length === 0 ? 0 : -grossLoss / losses.length,
  };
}

export function periodsPerYearFromTimeframe(timeframe: string): number {
  const sec = timeframeSeconds(timeframe);
  return SEC_PER_YEAR / sec;
}

export function timeframeSeconds(timeframe: string): number {
  const m = timeframe.match(/^(\d+)([mhd])$/);
  if (!m) throw new Error(`bad timeframe: ${timeframe}`);
  const n = Number(m[1]);
  const unit = m[2]!;
  switch (unit) {
    case "m":
      return n * 60;
    case "h":
      return n * 3600;
    case "d":
      return n * 86400;
    default:
      throw new Error(`bad timeframe unit: ${unit}`);
  }
}

export function computeRunMetrics(args: {
  equity: ReadonlyArray<EquityPoint>;
  trades: ReadonlyArray<Trade>;
  startTs: number;
  endTs: number;
  timeframe: string;
  initialCashUsd: number;
}): RunMetrics {
  const equityVals = args.equity.map((p) => p.equity);
  const rets = returns(equityVals);
  const ppy = periodsPerYearFromTimeframe(args.timeframe);
  const ts = tradeStats(args.trades);
  const last = equityVals[equityVals.length - 1] ?? args.initialCashUsd;
  const totalReturnPct = (last - args.initialCashUsd) / args.initialCashUsd;
  const maxDd = maxDrawdown(equityVals);
  const cagrPct = cagr(equityVals, args.startTs, args.endTs);
  const exposurePct =
    args.equity.length === 0 ? 0 : args.trades.length / args.equity.length;
  return {
    totalReturnPct,
    cagrPct,
    sharpe: sharpe(rets, ppy),
    sortino: sortino(rets, ppy),
    maxDrawdownPct: maxDd,
    calmar: maxDd === 0 ? 0 : cagrPct / Math.abs(maxDd),
    winRatePct: ts.winRatePct,
    profitFactor: ts.profitFactor,
    tradeCount: args.trades.length,
    avgWinPct: ts.avgWinPct,
    avgLossPct: ts.avgLossPct,
    exposurePct,
  };
}
