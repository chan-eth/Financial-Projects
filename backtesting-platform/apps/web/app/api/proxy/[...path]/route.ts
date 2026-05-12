import { NextResponse } from "next/server";

const WORKER_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.getdebanked.xyz";

async function forward(req: Request, params: { path: string[] }) {
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
