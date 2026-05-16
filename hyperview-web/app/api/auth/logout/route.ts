import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workerPost } from "@/lib/authServer";
import { HV_SESSION_COOKIE, clearCookieOptions } from "@/lib/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(HV_SESSION_COOKIE)?.value;

  // Best-effort: let the worker know (it's stateless, so this is a no-op
  // server-side, but kept so future revocation-list code can hook in).
  if (token) {
    try {
      await workerPost("/auth/logout", {}, { sessionToken: token });
    } catch {
      // Swallow — clearing the cookie is what matters for the user.
    }
  }

  jar.set(HV_SESSION_COOKIE, "", clearCookieOptions("/"));
  return new NextResponse(null, { status: 204 });
}
