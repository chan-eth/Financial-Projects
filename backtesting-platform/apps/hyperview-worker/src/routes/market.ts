// Market-data REST proxy.
//
// Public endpoints, no auth. Proxies the Hyperliquid `/info` endpoint via the
// existing @bt/data client. M0 surface only:
//
//   GET /market/meta
//     → { universe: HlUniverseAsset[] }
//
//   GET /market/candles?symbol=BTC&tf=1h&startMs=...&endMs=...
//     → { bars: HlBar[] }
//
// The streaming WebSocket fan-out (Durable Objects) lands in M2 per PLAN §3.

import { z } from "zod";
import { HyperliquidClient } from "@bt/data/hyperliquid";
import { Timeframe } from "@bt/schemas";
import { BadRequestError, UpstreamError } from "../errors.js";
import type { Env } from "../env.js";

const CandlesQuery = z.object({
  symbol: z.string().regex(/^[A-Z0-9._-]{1,32}$/),
  tf: Timeframe,
  startMs: z.coerce.number().int().nonnegative(),
  endMs: z.coerce.number().int().positive(),
}).refine((q) => q.endMs > q.startMs, {
  message: "endMs must be greater than startMs",
  path: ["endMs"],
});

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days; further ranges must paginate.

export async function handleMarket(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (request.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }

  const path = url.pathname;
  const client = new HyperliquidClient(fetch, env.HYPERLIQUID_API_BASE);

  if (path === "/market/meta") {
    try {
      const universe = await client.metaUniverse();
      return json({ universe });
    } catch (err) {
      throw new UpstreamError(502, "hyperliquid meta failed", { cause: String(err) });
    }
  }

  if (path === "/market/candles") {
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { params[k] = v; });
    const parsed = CandlesQuery.safeParse(params);
    if (!parsed.success) {
      throw new BadRequestError("invalid query", parsed.error.flatten());
    }
    if (parsed.data.endMs - parsed.data.startMs > MAX_RANGE_MS) {
      throw new BadRequestError("range too large; max 90 days per request");
    }
    try {
      const bars = await client.candles({
        coin: parsed.data.symbol,
        timeframe: parsed.data.tf,
        startMs: parsed.data.startMs,
        endMs: parsed.data.endMs,
      });
      return json({ bars });
    } catch (err) {
      throw new UpstreamError(502, "hyperliquid candles failed", { cause: String(err) });
    }
  }

  return json({ error: "not found" }, 404);
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
