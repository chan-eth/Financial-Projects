import { CreateRunRequest } from "@bt/schemas";
import { ZodError } from "zod";
import { json } from "../index.js";
import type { Env } from "../env.js";
import { createRun, getRun, listRuns } from "../repo/runs.js";
import { R2_PREFIX } from "@bt/data/r2-parquet";
import type { AuthContext } from "../auth.js";
import { BadRequestError, NotFoundError } from "../errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleRuns(req: Request, env: Env, url: URL, auth: AuthContext): Promise<Response> {
  if (req.method === "GET" && url.pathname === "/runs") {
    const rows = await listRuns(env.DB, {
      limit: clampInt(url.searchParams.get("limit"), 50, 1, 200),
      strategyKind: url.searchParams.get("strategy") ?? undefined,
    });
    return json({ runs: rows });
  }

  if (req.method === "POST" && url.pathname === "/runs") {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new BadRequestError("invalid JSON body");
    }
    let body;
    try {
      body = CreateRunRequest.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestError("validation failed", err.issues);
      throw err;
    }

    const idempotencyKey = req.headers.get("idempotency-key");
    const idempotencyKeyHash = idempotencyKey ? await sha256Hex(idempotencyKey) : null;

    const run = await createRun(env.DB, body, {
      ip: req.headers.get("cf-connecting-ip"),
      email: auth.email,
      idempotencyKeyHash,
    });
    // Only enqueue when the row is new — idempotent retries return the same
    // row but should not enqueue a second job.
    if (run.status === "queued" && run.startedAt == null && run.finishedAt == null) {
      await env.Q.send({ kind: "run-backtest", runId: run.id, chunkIndex: 0 });
    }
    return json({ runId: run.id, status: run.status }, 202);
  }

  const idMatch = url.pathname.match(
    /^\/runs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(tearsheet|equity|trades))?$/i,
  );
  if (idMatch && req.method === "GET") {
    const runId = idMatch[1]!;
    if (!UUID_RE.test(runId)) throw new BadRequestError("malformed runId");
    const sub = idMatch[2];
    if (sub == null) {
      const run = await getRun(env.DB, runId);
      if (run == null) throw new NotFoundError("run not found");
      return json({ run });
    }
    if (sub === "tearsheet") {
      const obj = await env.DATA.get(R2_PREFIX.runTearsheet(runId));
      if (obj == null) throw new NotFoundError("tearsheet not ready");
      return new Response(obj.body, { headers: { "content-type": "application/json" } });
    }
    if (sub === "equity") {
      const obj = await env.DATA.get(R2_PREFIX.runEquity(runId));
      if (obj == null) throw new NotFoundError("equity not found");
      return new Response(obj.body, { headers: { "content-type": "application/x-ndjson" } });
    }
    if (sub === "trades") {
      const obj = await env.DATA.get(R2_PREFIX.runTrades(runId));
      if (obj == null) throw new NotFoundError("trades not found");
      return new Response(obj.body, { headers: { "content-type": "application/x-ndjson" } });
    }
  }

  throw new NotFoundError();
}

function clampInt(s: string | null, def: number, lo: number, hi: number): number {
  if (s == null) return def;
  const n = Number(s);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
