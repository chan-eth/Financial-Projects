import type { Timeframe } from "@bt/schemas";

export const HYPERLIQUID_API = "https://api.hyperliquid.xyz";

const TF_TO_INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

export interface HlBar {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HlUniverseAsset {
  name: string;
  maxLeverage: number;
  szDecimals: number;
}

export class HyperliquidClient {
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly base = HYPERLIQUID_API) {}

  async metaUniverse(): Promise<HlUniverseAsset[]> {
    const res = await this.post({ type: "meta" });
    const universe = (res as { universe?: HlUniverseAsset[] }).universe ?? [];
    return universe;
  }

  async candles(args: {
    coin: string;
    timeframe: Timeframe;
    startMs: number;
    endMs: number;
  }): Promise<HlBar[]> {
    const interval = TF_TO_INTERVAL[args.timeframe];
    const res = await this.post({
      type: "candleSnapshot",
      req: {
        coin: args.coin,
        interval,
        startTime: args.startMs,
        endTime: args.endMs,
      },
    });
    if (!Array.isArray(res)) return [];
    return res.map(toBar);
  }

  private async post(body: unknown): Promise<unknown> {
    const r = await this.fetcher(`${this.base}/info`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`hyperliquid /info ${r.status}: ${await r.text()}`);
    return r.json();
  }
}

interface RawHlCandle {
  t: number;
  o: string | number;
  h: string | number;
  l: string | number;
  c: string | number;
  v: string | number;
}

function toBar(raw: unknown): HlBar {
  const r = raw as RawHlCandle;
  return {
    ts: Math.floor(r.t / 1000),
    open: Number(r.o),
    high: Number(r.h),
    low: Number(r.l),
    close: Number(r.c),
    volume: Number(r.v),
  };
}
