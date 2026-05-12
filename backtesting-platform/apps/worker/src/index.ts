import { handleRuns } from "./routes/runs.js";
import { handleStrategies } from "./routes/strategies.js";
import { handleIngest } from "./routes/ingest.js";
import { processJob } from "./consumer.js";
import type { Env, JobMessage } from "./env.js";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (!authorized(req, env)) {
      return json({ error: "unauthorized" }, 401, cors);
    }

    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith("/runs")) return withCors(await handleRuns(req, env, url), cors);
      if (url.pathname.startsWith("/strategies")) return withCors(await handleStrategies(req, env, url), cors);
      if (url.pathname.startsWith("/ingest")) return withCors(await handleIngest(req, env, url), cors);
      if (url.pathname === "/healthz") return withCors(json({ ok: true }), cors);
    } catch (err) {
      return withCors(json({ error: (err as Error).message }, 500), cors);
    }
    return withCors(json({ error: "not found" }, 404), cors);
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

function authorized(req: Request, env: Env): boolean {
  if (env.WORKER_INTERNAL_SECRET == null) return true;
  return req.headers.get("x-internal-secret") === env.WORKER_INTERNAL_SECRET;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-internal-secret",
    "access-control-max-age": "86400",
  };
}

function withCors(res: Response, cors: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}
