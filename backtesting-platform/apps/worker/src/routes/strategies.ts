import { json } from "../index.js";
import type { Env } from "../env.js";

export async function handleStrategies(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === "GET" && url.pathname === "/strategies") {
    const { results } = await env.DB.prepare(
      `SELECT id, name, kind, params_json, created_at FROM strategies ORDER BY created_at DESC`,
    ).all();
    return json({ strategies: results });
  }
  return json({ error: "not found" }, 404);
}
