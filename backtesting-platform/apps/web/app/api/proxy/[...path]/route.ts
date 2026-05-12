import { NextResponse } from "next/server";

const WORKER_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.getdebanked.xyz";
const MAX_BODY_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
const ALLOWED_METHODS = new Set(["GET", "POST", "HEAD"]);

// Allowed origins for the proxy. Anything else is rejected — this is the CSRF
// fence that prevents a malicious site from triggering authenticated calls via
// the user's browser. Vercel preview deployments come in on *.vercel.app.
function originAllowed(origin: string | null, host: string | null): boolean {
  if (origin == null) return true; // same-origin / curl
  try {
    const u = new URL(origin);
    if (u.hostname === "getdebanked.xyz") return true;
    if (u.hostname.endsWith(".vercel.app")) return true;
    if (host != null && u.host === host) return true; // localhost dev
    return false;
  } catch {
    return false;
  }
}

async function forward(req: Request, params: { path: string[] }) {
  if (!ALLOWED_METHODS.has(req.method)) {
    return NextResponse.json({ error: "method not allowed" }, { status: 405 });
  }

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!originAllowed(origin, host)) {
    return NextResponse.json({ error: "forbidden origin" }, { status: 403 });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const path = "/" + (params.path?.join("/") ?? "");
  const url = new URL(req.url);
  const target = `${WORKER_BASE}${path}${url.search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  if (process.env.WORKER_INTERNAL_SECRET) {
    headers.set("x-internal-secret", process.env.WORKER_INTERNAL_SECRET);
  }

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "payload too large" }, { status: 413 });
    }
    body = buf;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "TimeoutError";
    return NextResponse.json(
      { error: isAbort ? "upstream timeout" : "upstream error" },
      { status: isAbort ? 504 : 502 },
    );
  }

  const responseHeaders = new Headers();
  const upstreamCt = upstream.headers.get("content-type");
  if (upstreamCt) responseHeaders.set("content-type", upstreamCt);
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, await params);
}
export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, await params);
}
export async function HEAD(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, await params);
}
