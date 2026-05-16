import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workerPost } from "@/lib/authServer";
import {
  HV_REG_COOKIE,
  HV_SESSION_COOKIE,
  clearCookieOptions,
  sessionCookieOptions,
} from "@/lib/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const jar = await cookies();
  const ceremonyId = jar.get(HV_REG_COOKIE)?.value;
  if (!ceremonyId) {
    return NextResponse.json(
      { error: "login ceremony cookie missing or expired" },
      { status: 400 },
    );
  }

  let body: { response?: unknown };
  try {
    body = (await request.json()) as { response?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const res = await workerPost("/auth/passkey/login/verify", {
    ceremonyId,
    response: body.response,
  });

  jar.set(HV_REG_COOKIE, "", clearCookieOptions("/api/auth"));

  if (!res.ok) return passThrough(res);
  const { user, sessionToken } = (await res.json()) as {
    user: unknown;
    sessionToken: string;
  };
  jar.set(HV_SESSION_COOKIE, sessionToken, sessionCookieOptions());

  return NextResponse.json({ user }, { status: 200 });
}

async function passThrough(res: Response): Promise<Response> {
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
