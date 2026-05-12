import { handleRuns } from "./routes/runs.js";
import { handleStrategies } from "./routes/strategies.js";
import { handleIngest } from "./routes/ingest.js";
import { processJob } from "./consumer.js";
import { requireAuth } from "./auth.js";
import { enforceRateLimits } from "./middleware/rate-limit.js";
import { HttpError, TooManyRequestsError } from "./errors.js";
import type { Env, JobMessage } from "./env.js";

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      const auth = requireAuth(req, env);
      await enforceRateLimits(req, env, auth);

      const url = new URL(req.url);
      const p = url.pathname;
      if (p === "/runs" || p.startsWith("/runs/")) return finalize(await handleRuns(req, env, url, auth), cors);
      if (p === "/strategies" || p.startsWith("/strategies/")) return finalize(await handleStrategies(req, env, url, auth), cors);
      if (p === "/ingest" || p.startsWith("/ingest/")) return finalize(await handleIngest(req, env, url, auth), cors);
      if (p === "/healthz") return finalize(json({ ok: true }), cors);
      return finalize(json({ error: "not found" }, 404), cors);
    } catch (err) {
      return finalize(toErrorResponse(err), cors);
    }
  },

  async queue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await processJob(msg.body, env);
        msg.ack();
      } catch (err) {
        console.error("job failed", err);
        msg.retry();
      }
    }
  },
};

function toErrorResponse(err: unknown): Response {
  if (err instanceof TooManyRequestsError) {
    return json({ error: err.message }, err.status, {
      "retry-after": String(err.retryAfterSec),
    });
  }
  if (err instanceof HttpError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.details != null) body.details = err.details;
    return json(body, err.status);
  }
  // Unhandled — generate a correlation ID, log internally, return opaque 500.
  const requestId = crypto.randomUUID();
  console.error("unhandled error", requestId, err);
  return json({ error: "internal error", requestId }, 500);
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? "https://getdebanked.xyz")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function originAllowed(reqOrigin: string | null, allow: string[]): string | null {
  if (reqOrigin == null) return null;
  for (const pattern of allow) {
    if (pattern === reqOrigin) return reqOrigin;
    if (pattern.includes("*") && wildcardMatch(pattern, reqOrigin)) return reqOrigin;
  }
  return null;
}

/** Matches patterns like `https://*.vercel.app` against a concrete origin. */
function wildcardMatch(pattern: string, value: string): boolean {
  const parts = pattern.split("*").map(escapeRegex);
  const regex = new RegExp("^" + parts.join("[^.]+") + "$");
  return regex.test(value);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const allow = allowedOrigins(env);
  const reflected = originAllowed(req.headers.get("origin"), allow);
  const headers: Record<string, string> = {
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-internal-secret,idempotency-key",
    "access-control-max-age": "86400",
    "vary": "origin",
  };
  if (reflected) headers["access-control-allow-origin"] = reflected;
  return headers;
}

function finalize(res: Response, cors: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}
