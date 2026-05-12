import type { Env } from "../env.js";
import { TooManyRequestsError } from "../errors.js";
import type { AuthContext } from "../auth.js";

/**
 * Cloudflare's native Rate Limiting binding. Two limiters wired in
 * `wrangler.toml`:
 *
 *   RL_GLOBAL — 60 requests / minute, keyed on the caller IP.
 *   RL_RUNS   — 10 requests / minute, keyed on the caller IP. Applied only
 *               on `POST /runs` to keep run-creation traffic bounded.
 *
 * Operators (authenticated via Cloudflare Access) bypass the limiters so a
 * legitimate human running parameter sweeps isn't gated.
 */
export async function enforceRateLimits(
  req: Request,
  env: Env,
  auth: AuthContext,
): Promise<void> {
  if (auth.email != null) return; // Access-authenticated operators bypass.

  const ip = req.headers.get("cf-connecting-ip") ?? "anonymous";

  const global = await env.RL_GLOBAL.limit({ key: ip });
  if (!global.success) throw new TooManyRequestsError(60);

  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname === "/runs") {
    const runs = await env.RL_RUNS.limit({ key: ip });
    if (!runs.success) throw new TooManyRequestsError(60);
  }
}
