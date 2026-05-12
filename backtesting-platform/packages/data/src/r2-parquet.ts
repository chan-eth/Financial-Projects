/**
 * R2 key conventions + a JSON-lines fallback writer.
 *
 * Real parquet writes belong in `scripts/ingest-*` (Node, can use `parquetjs`
 * or `apache-arrow`). The Worker reads via R2 range gets and parses lazily.
 * Phase 1 supports JSON-lines (one event per line) as the on-disk format so
 * the Worker can stream-parse without bundling parquet into the Workers
 * runtime; Phase 2 swaps to parquet for size.
 */

export const R2_PREFIX = {
  bars: (venue: string, symbol: string, timeframe: string, yyyymm: string) =>
    `data/${venue}/${symbol}/${timeframe}/${yyyymm}.jsonl`,
  l2: (venue: string, symbol: string, yyyymmdd: string) =>
    `data/${venue}/l2/${symbol}/${yyyymmdd}.jsonl`,
  index: (index: string, yyyymm: string) => `data/index/${index}/${yyyymm}.jsonl`,
  kalshiCandles: (ticker: string) => `data/kalshi/candles/${ticker}.jsonl`,
  kalshiBooks: (ticker: string, yyyymmdd: string) =>
    `data/kalshi/orderbook/${ticker}/${yyyymmdd}.jsonl`,
  runEquity: (runId: string) => `runs/${runId}/equity.jsonl`,
  runTrades: (runId: string) => `runs/${runId}/trades.jsonl`,
  runTearsheet: (runId: string) => `runs/${runId}/tearsheet.json`,
  runCheckpoint: (runId: string, n: number) => `runs/${runId}/checkpoint-${n}.json`,
} as const;

export function ymKey(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ymdKey(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function jsonlEncode<T>(rows: ReadonlyArray<T>): string {
  return rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

export function jsonlDecode<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    out.push(JSON.parse(line) as T);
  }
  return out;
}
