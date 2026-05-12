import { CreateRunRequest } from "@bt/schemas";
import { json } from "../index.js";
import type { Env } from "../env.js";
import { createRun, getRun, listRuns } from "../repo/runs.js";
import { R2_PREFIX } from "@bt/data/r2-parquet";

export async function handleRuns(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === "GET" && url.pathname === "/runs") {
    const rows = await listRuns(env.DB, {
      limit: clampInt(url.searchParams.get("limit"), 50, 1, 200),
      strategyKind: url.searchParams.get("strategy") ?? undefined,
    });
    return json({ runs: rows });
  }

  if (req.method === "POST" && url.pathname === "/runs") {
    const body = CreateRunRequest.parse(await req.json());
    const run = await createRun(env.DB, body);
    await env.Q.send({ kind: "run-backtest", runId: run.id, chunkIndex: 0 });
    return json({ runId: run.id, status: run.status }, 202);
  }

  const idMatch = url.pathname.match(/^\/runs\/([^/]+)(?:\/(tearsheet|equity|trades))?$/);
  if (idMatch && req.method === "GET") {
    const runId = idMatch[1]!;
    const sub = idMatch[2];
    if (sub == null) {
      const run = await getRun(env.DB, runId);
      if (run == null) return json({ error: "run not found" }, 404);
      return json({ run });
    }
    if (sub === "tearsheet") {
      const obj = await env.DATA.get(R2_PREFIX.runTearsheet(runId));
      if (obj == null) return json({ error: "tearsheet not ready" }, 404);
      return new Response(obj.body, { headers: { "content-type": "application/json" } });
    }
    if (sub === "equity") {
      const obj = await env.DATA.get(R2_PREFIX.runEquity(runId));
      if (obj == null) return json({ error: "equity not found" }, 404);
      return new Response(obj.body, { headers: { "content-type": "application/x-ndjson" } });
    }
    if (sub === "trades") {
      const obj = await env.DATA.get(R2_PREFIX.runTrades(runId));
      if (obj == null) return json({ error: "trades not found" }, 404);
      return new Response(obj.body, { headers: { "content-type": "application/x-ndjson" } });
    }
  }

  return json({ error: "not found" }, 404);
}

function clampInt(s: string | null, def: number, lo: number, hi: number): number {
  if (s == null) return def;
  const n = Number(s);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}
