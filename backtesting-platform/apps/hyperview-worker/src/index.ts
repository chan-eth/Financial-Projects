// HyperView worker entry.
//
// Adds endpoints incrementally per the milestone schedule in hyperview/PLAN.md §8.
// Every new endpoint MUST: (1) be gated by the auth fence in ./auth.ts, (2) validate
// input with a Zod schema, (3) be covered by the per-milestone audit gate (§9).

import { handleMarket } from "./routes/market.js";
import { requireAuth } from "./auth.js";
import { corsHeaders } from "./middleware/cors.js";
import { HttpError, NotFoundError, TooManyRequestsError } from "./errors.js";
import type { Env } from "./env.js";

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

const VERSION = "0.0.0-m0";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Global per-IP rate limit on every request (skipped if binding absent in dev).
      if (env.RL_GLOBAL) {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        const { success } = await env.RL_GLOBAL.limit({ key: ip });
        if (!success) throw new TooManyRequestsError(60);
      }

      // Health probe — public, unauthenticated.
      if (path === "/health" && request.method === "GET") {
        return finalize(
          Response.json({ ok: true, version: VERSION, milestone: "M0" }),
          cors,
        );
      }

      // Public market-data proxy.
      if (path === "/market/meta" || path === "/market/candles") {
        await requireAuth(request, "public");
        return finalize(await handleMarket(request, env, url), cors);
      }

      throw new NotFoundError();
    } catch (err) {
      return finalize(toErrorResponse(err), cors);
    }
  },
};

function toErrorResponse(err: unknown): Response {
  if (err instanceof TooManyRequestsError) {
    return Response.json(
      { error: err.message },
      { status: err.status, headers: { "retry-after": String(err.retryAfterSec) } },
    );
  }
  if (err instanceof HttpError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.details != null) body.details = err.details;
    return Response.json(body, { status: err.status });
  }
  const requestId = crypto.randomUUID();
  console.error("unhandled error", requestId, err);
  return Response.json({ error: "internal error", requestId }, { status: 500 });
}

function finalize(res: Response, cors: Record<string, string>): Response {
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}
