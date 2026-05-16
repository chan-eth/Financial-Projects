// Short-lived storage for in-flight WebAuthn ceremonies.
//
// Stored as KV blobs keyed by a freshly-minted UUID (ceremonyId) with a TTL
// of 5 minutes. The ceremonyId travels back to the browser inside a strict
// same-site cookie on the web app (set by the Next.js proxy), and is
// surrendered on the matching /verify call. KV TTL guarantees no zombie
// challenges outlive the ceremony.

export interface PendingRegistration {
  type: "register";
  challenge: string;          // base64url; matches @simplewebauthn options.challenge
  userIdToCreate: string;     // ULID we'll commit to D1 if verify succeeds
  primaryAddress: string;     // 0x… provided at start; bound to this ceremony
  displayName?: string;
  createdAt: number;          // unix seconds
}

export interface PendingLogin {
  type: "login";
  challenge: string;
  // The login ceremony is "discoverable" — we accept any credential the
  // authenticator surfaces. We only know which user it was after verify.
  createdAt: number;
}

export type PendingCeremony = PendingRegistration | PendingLogin;

const TTL_SECONDS = 5 * 60;

export async function storeCeremony(
  kv: KVNamespace,
  ceremony: PendingCeremony,
): Promise<string> {
  const id = crypto.randomUUID();
  await kv.put(keyFor(id), JSON.stringify(ceremony), { expirationTtl: TTL_SECONDS });
  return id;
}

export async function takeCeremony(
  kv: KVNamespace,
  id: string,
): Promise<PendingCeremony | null> {
  const raw = await kv.get(keyFor(id));
  if (raw == null) return null;
  // One-shot: delete on read so a captured ceremonyId can't be reused.
  await kv.delete(keyFor(id));
  try {
    return JSON.parse(raw) as PendingCeremony;
  } catch {
    return null;
  }
}

function keyFor(id: string): string {
  return `ceremony:${id}`;
}
