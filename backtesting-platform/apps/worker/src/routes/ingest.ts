import { json } from "../index.js";
import type { Env } from "../env.js";

/**
 * Admin endpoint to enqueue an ingest job. In Phase 1 ingest is typically
 * driven by the local CLIs (`scripts/ingest-*.ts`); this exists so an
 * authenticated operator can trigger an in-Worker pull when the cron
 * scheduler is added in Phase 2.
 */
export async function handleIngest(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const body = (await req.json()) as { venue?: "hyperliquid" | "kalshi" | "brti"; days?: number };
  if (body.venue == null) return json({ error: "venue required" }, 400);
  const days = body.days ?? 70;

  await env.Q.send({ kind: "ingest", venue: body.venue, days });
  return json({ ok: true, venue: body.venue, days }, 202);
}
