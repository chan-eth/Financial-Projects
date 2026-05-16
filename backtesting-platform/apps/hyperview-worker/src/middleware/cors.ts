import type { Env } from "../env.js";

const ALLOWED_METHODS = "GET,POST,OPTIONS";
const ALLOWED_HEADERS = "content-type,x-internal-secret,idempotency-key";

export function corsHeaders(req: Request, env: Env): Record<string, string> {
  const allow = parseAllowlist(env.ALLOWED_ORIGINS);
  const reflected = originAllowed(req.headers.get("origin"), allow);
  const headers: Record<string, string> = {
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-allow-headers": ALLOWED_HEADERS,
    "access-control-max-age": "86400",
    vary: "origin",
  };
  if (reflected) {
    headers["access-control-allow-origin"] = reflected;
  }
  return headers;
}

function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
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

function wildcardMatch(pattern: string, value: string): boolean {
  const parts = pattern.split("*").map(escapeRegex);
  const regex = new RegExp("^" + parts.join("[^.]+") + "$");
  return regex.test(value);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
