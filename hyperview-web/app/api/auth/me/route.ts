import { NextResponse } from "next/server";
import { workerGet, readSessionToken } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request): Promise<Response> {
  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const res = await workerGet("/auth/me", { sessionToken: token });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
