export const CFB_API = "https://www.cfbenchmarks.com/api/v1";

export type CfbIndex = "BRTI" | "ETHUSD_RTI" | "SOLUSD_RTI" | "DOGEUSD_RTI";

export interface IndexBar {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface IndexClient {
  /** Returns minute-bar index history for [startTs, endTs] (seconds, inclusive). */
  history(args: { index: CfbIndex; startTs: number; endTs: number }): Promise<IndexBar[]>;
}

/**
 * CF Benchmarks historical endpoint client. Uses the published methodology
 * (https://www.cfbenchmarks.com/data) and serves delayed/historical data
 * which does not require the licensed real-time feed.
 */
export class CfBenchmarksClient implements IndexClient {
  constructor(
    private readonly token: string | null = null,
    private readonly fetcher: typeof fetch = fetch,
    private readonly base = CFB_API,
  ) {}

  async history(args: { index: CfbIndex; startTs: number; endTs: number }): Promise<IndexBar[]> {
    const path = `/values/${args.index}?from=${args.startTs}&to=${args.endTs}&interval=60`;
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    const r = await this.fetcher(`${this.base}${path}`, { headers });
    if (!r.ok) throw new Error(`cfbenchmarks ${args.index} ${r.status}: ${await r.text()}`);
    const raw = (await r.json()) as { values: Array<{ time: number; o: number; h: number; l: number; c: number }> };
    return raw.values.map((v) => ({ ts: v.time, open: v.o, high: v.h, low: v.l, close: v.c }));
  }
}

/**
 * Fallback index reconstructor — when an RTI/BRTI endpoint is gated, derive
 * the index from constituent spot trades per the published methodology
 * (volume-weighted median, outlier filtering, etc.). 70-day window is small
 * enough that this is tractable from public exchange endpoints.
 *
 * This is intentionally a typed stub: the reconstruction pipeline is wired in
 * the ingest CLI (`scripts/ingest-brti.ts`) which orchestrates per-exchange
 * fetches via the venue-specific clients you provide.
 */
export class ReconstructedIndexClient implements IndexClient {
  constructor(private readonly methodology: IndexMethodology) {}

  async history(args: { index: CfbIndex; startTs: number; endTs: number }): Promise<IndexBar[]> {
    return this.methodology.reconstruct(args.index, args.startTs, args.endTs);
  }
}

export interface IndexMethodology {
  reconstruct(index: CfbIndex, startTs: number, endTs: number): Promise<IndexBar[]>;
}
