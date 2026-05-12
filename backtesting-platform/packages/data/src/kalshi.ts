import type { KalshiMarket, KalshiSnapshot } from "@bt/schemas";

export const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

export interface KalshiSigner {
  signHeaders(method: string, path: string, ts: string): Promise<Record<string, string>>;
}

/**
 * Signs Kalshi requests with RSA-PSS over (timestamp + method + path).
 * Pass the PEM via construction so secrets never leave the Worker.
 */
export class KalshiRsaSigner implements KalshiSigner {
  constructor(private readonly keyId: string, private readonly privateKey: CryptoKey) {}

  static async fromPem(keyId: string, pem: string): Promise<KalshiRsaSigner> {
    const key = await importPkcs8(pem);
    return new KalshiRsaSigner(keyId, key);
  }

  async signHeaders(method: string, path: string, ts: string): Promise<Record<string, string>> {
    const msg = new TextEncoder().encode(`${ts}${method.toUpperCase()}${path}`);
    const sig = await crypto.subtle.sign(
      { name: "RSA-PSS", saltLength: 32 },
      this.privateKey,
      msg,
    );
    return {
      "KALSHI-ACCESS-KEY": this.keyId,
      "KALSHI-ACCESS-SIGNATURE": btoa(String.fromCharCode(...new Uint8Array(sig))),
      "KALSHI-ACCESS-TIMESTAMP": ts,
    };
  }
}

export class KalshiClient {
  private readonly minIntervalMs: number;
  private nextAllowedAt = 0;

  constructor(
    private readonly signer: KalshiSigner | null = null,
    private readonly fetcher: typeof fetch = fetch,
    private readonly base = KALSHI_API,
    opts: { requestsPerSecond?: number } = {},
  ) {
    this.minIntervalMs = 1000 / (opts.requestsPerSecond ?? 8);
  }

  async listMarkets(opts: { eventTicker?: string; status?: "open" | "settled"; limit?: number; cursor?: string }): Promise<{ markets: KalshiMarket[]; cursor: string | null }> {
    const params = new URLSearchParams();
    if (opts.eventTicker) params.set("event_ticker", opts.eventTicker);
    if (opts.status) params.set("status", opts.status);
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.cursor) params.set("cursor", opts.cursor);
    const raw = (await this.get(`/markets?${params.toString()}`)) as {
      markets: Array<{
        ticker: string;
        event_ticker: string;
        series_ticker: string;
        strike: number;
        open_time: string;
        close_time: string;
        settlement_value: number | null;
      }>;
      cursor: string | null;
    };
    return {
      markets: raw.markets.map(toMarket),
      cursor: raw.cursor ?? null,
    };
  }

  async candlesticks(args: {
    ticker: string;
    startTs: number;
    endTs: number;
    periodIntervalSec: number;
  }): Promise<Array<{ ts: number; yesBidClose: number; yesAskClose: number; volume: number }>> {
    const path = `/markets/${args.ticker}/candlesticks?start_ts=${args.startTs}&end_ts=${args.endTs}&period_interval=${args.periodIntervalSec}`;
    const r = (await this.get(path)) as {
      candlesticks: Array<{
        end_period_ts: number;
        yes_bid: { close: number };
        yes_ask: { close: number };
        volume: number;
      }>;
    };
    return r.candlesticks.map((c) => ({
      ts: c.end_period_ts,
      yesBidClose: c.yes_bid.close,
      yesAskClose: c.yes_ask.close,
      volume: c.volume,
    }));
  }

  async orderbookSnapshot(ticker: string): Promise<KalshiSnapshot | null> {
    const r = (await this.get(`/markets/${ticker}/orderbook?depth=1`)) as {
      orderbook: {
        yes: Array<[number, number]>;
        no: Array<[number, number]>;
      };
    };
    const yesBid = r.orderbook.yes[0]?.[0] ?? 0;
    const noBid = r.orderbook.no[0]?.[0] ?? 0;
    return {
      id: `${ticker}:${Date.now()}`,
      marketTicker: ticker,
      ts: Math.floor(Date.now() / 1000),
      yesBid,
      yesAsk: 100 - noBid,
      noBid,
      noAsk: 100 - yesBid,
      volume: 0,
      underlyingIndexPrice: null,
    };
  }

  private async get(path: string): Promise<unknown> {
    await this.throttle();
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.signer) {
      const ts = String(Date.now());
      Object.assign(headers, await this.signer.signHeaders("GET", path, ts));
    }
    const r = await this.fetcher(`${this.base}${path}`, { headers });
    if (!r.ok) throw new Error(`kalshi GET ${path} ${r.status}: ${await r.text()}`);
    return r.json();
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    if (now < this.nextAllowedAt) {
      await new Promise((res) => setTimeout(res, this.nextAllowedAt - now));
    }
    this.nextAllowedAt = Math.max(now, this.nextAllowedAt) + this.minIntervalMs;
  }
}

function toMarket(raw: {
  ticker: string;
  event_ticker: string;
  series_ticker: string;
  strike: number;
  open_time: string;
  close_time: string;
  settlement_value: number | null;
}): KalshiMarket {
  return {
    ticker: raw.ticker,
    eventTicker: raw.event_ticker,
    series: raw.series_ticker as KalshiMarket["series"],
    strike: raw.strike,
    openTs: Math.floor(new Date(raw.open_time).getTime() / 1000),
    closeTs: Math.floor(new Date(raw.close_time).getTime() / 1000),
    settlementValue: raw.settlement_value,
  };
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"],
  );
}
