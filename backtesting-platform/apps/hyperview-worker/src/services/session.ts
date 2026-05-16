// Session tokens — HS256 JWT signed with SESSION_SIGNING_SECRET.
//
// Stateless on read: a token is valid iff the signature checks out AND
// `exp` is in the future. We do NOT round-trip to D1 on every request; if
// we ever need a kill-switch (e.g. compromised account) we either roll the
// signing secret (invalidates everything) or add a small revocation list.
//
// Token shape:
//   { uid: string,   // hv_user.user_id ULID
//     scope: "user", // future: "user.trading" if recently biometric-attested
//     iat: number,   // unix seconds
//     exp: number }  // unix seconds

export interface SessionPayload {
  uid: string;
  scope: "user" | "user.trading";
  iat: number;
  exp: number;
}

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function issueSession(
  uid: string,
  signingSecret: string,
): Promise<{ token: string; payload: SessionPayload }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid,
    scope: "user",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const token = await signJwt({ ...payload }, signingSecret);
  return { token, payload };
}

export async function verifySession(
  token: string,
  signingSecret: string,
): Promise<SessionPayload> {
  const payload = await verifyJwt(token, signingSecret);
  const uid = payload["uid"];
  const scope = payload["scope"];
  const iat = payload["iat"];
  const exp = payload["exp"];
  if (typeof uid !== "string" || uid.length === 0) {
    throw new Error("session payload missing uid");
  }
  if (typeof exp !== "number" || exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("session expired");
  }
  if (typeof iat !== "number") {
    throw new Error("session payload missing iat");
  }
  if (scope !== "user" && scope !== "user.trading") {
    throw new Error("session payload has unknown scope");
  }
  return { uid, scope, iat, exp };
}

// ---- JWT (HS256) ------------------------------------------------------------

type AnyPayload = Record<string, unknown>;

async function signJwt(payload: AnyPayload, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const head = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${head}.${body}`;
  const sig = await hmacSha256(signingInput, secret);
  return `${signingInput}.${b64url(sig)}`;
}

async function verifyJwt(token: string, secret: string): Promise<AnyPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed jwt");
  const head = parts[0] ?? "";
  const body = parts[1] ?? "";
  const sig = parts[2] ?? "";
  if (!head || !body || !sig) throw new Error("malformed jwt");

  const signingInput = `${head}.${body}`;
  const expected = await hmacSha256(signingInput, secret);
  const provided = b64urlDecode(sig);
  if (!constantTimeEquals(new Uint8Array(expected), provided)) {
    throw new Error("jwt signature mismatch");
  }
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as AnyPayload;
  return payload;
}

async function hmacSha256(message: string, secret: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
}

function b64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    s += String.fromCharCode(byte);
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}
