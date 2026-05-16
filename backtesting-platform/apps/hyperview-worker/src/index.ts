// HyperView worker entry — M0 scaffolding.
//
// Adds endpoints incrementally per the milestone schedule in hyperview/PLAN.md §8.
// Every new endpoint MUST: (1) be gated by the auth fence in ./auth.ts, (2) validate
// input with a Zod schema from @hv/schemas, (3) be covered by the per-milestone
// audit gate before merge (PLAN.md §9).

export interface Env {
  ALLOWED_ORIGINS: string;
  HYPERLIQUID_API_BASE: string;
  RATE_LIMIT_GLOBAL_PER_MIN: string;
  RATE_LIMIT_ORDERS_PER_MIN: string;
  WORKER_INTERNAL_SECRET?: string;
}

const VERSION = "0.0.0-m0";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ ok: true, version: VERSION, milestone: "M0" });
    }

    return new Response("Not Found", { status: 404 });
  },
};
