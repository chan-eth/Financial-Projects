import { json } from "../index.js";
import type { Env } from "../env.js";
import type { AuthContext } from "../auth.js";
import { BadRequestError, HttpError } from "../errors.js";

/**
 * Admin endpoint to enqueue an ingest job. In Phase 1 ingest is typically
 * driven by the local CLIs (`scripts/ingest-*.ts`); this exists so an
 * authenticated operator can trigger an in-Worker pull when the cron
 * scheduler is added in Phase 2.
 */
export async function handleIngest(req: Request, env: Env, url: URL, _auth: AuthContext): Promise<Response> {
  void url;
  if (req.method !== "POST") throw new HttpError(405, "method not allowed");

  let body: { venue?: "hyperliquid" | "kalshi" | "brti"; days?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    throw new BadRequestError("invalid JSON body");
  }
  if (body.venue == null) throw new BadRequestError("venue required");
  const days = body.days ?? 70;

  await env.Q.send({ kind: "ingest", venue: body.venue, days });
  return json({ ok: true, venue: body.venue, days }, 202);
}
