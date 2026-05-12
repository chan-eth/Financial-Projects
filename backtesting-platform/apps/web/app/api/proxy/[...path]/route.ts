import { NextResponse } from "next/server";

const WORKER_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.getdebanked.xyz";

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
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!originAllowed(origin, host)) {
    return NextResponse.json({ error: "forbidden origin" }, { status: 403 });
  }

  const path = "/" + (params.path?.join("/") ?? "");
  const url = new URL(req.url);
  const target = `${WORKER_BASE}${path}${url.search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  if (process.env.WORKER_INTERNAL_SECRET) {
    headers.set("x-internal-secret", process.env.WORKER_INTERNAL_SECRET);
  }

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  const upstream = await fetch(target, { method: req.method, headers, body });
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
export async function PUT(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, await params);
}
export async function DELETE(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, await params);
}
