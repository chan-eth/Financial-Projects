import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workerPost } from "@/lib/authServer";
import { HV_REG_COOKIE, regCookieOptions } from "@/lib/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request): Promise<Response> {
  const res = await workerPost("/auth/passkey/login/start", {});
  if (!res.ok) return passThrough(res);

  const { options, ceremonyId } = (await res.json()) as {
    options: unknown;
    ceremonyId: string;
  };

  const jar = await cookies();
  jar.set(HV_REG_COOKIE, ceremonyId, regCookieOptions());

  return NextResponse.json({ options }, { status: 200 });
}

async function passThrough(res: Response): Promise<Response> {
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
