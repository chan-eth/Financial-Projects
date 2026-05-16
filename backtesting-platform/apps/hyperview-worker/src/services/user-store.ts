// D1 queries for hv_user / hv_user_passkey.
//
// All bind() parameters use placeholders; never interpolate user input into
// SQL strings. ULID minting lives here so the route layer never invents ids.

export interface HvUserRow {
  user_id: string;
  primary_address: string;
  display_name: string | null;
  entitlement_tier: "free" | "premium" | "team";
  created_at: string;
  last_seen_at: string | null;
}

export interface HvUserPasskeyRow {
  credential_id: string;
  user_id: string;
  public_key_cose: Uint8Array;
  sign_count: number;
  transports_json: string | null;
  aaguid: string | null;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
}

export async function findUserByAddress(
  db: D1Database,
  primaryAddress: string,
): Promise<HvUserRow | null> {
  const row = await db
    .prepare("SELECT * FROM hv_user WHERE primary_address = ?1 LIMIT 1")
    .bind(primaryAddress.toLowerCase())
    .first<HvUserRow>();
  return row ?? null;
}

export async function findUserById(
  db: D1Database,
  userId: string,
): Promise<HvUserRow | null> {
  const row = await db
    .prepare("SELECT * FROM hv_user WHERE user_id = ?1 LIMIT 1")
    .bind(userId)
    .first<HvUserRow>();
  return row ?? null;
}

export async function createUser(
  db: D1Database,
  user: { userId: string; primaryAddress: string; displayName?: string | null },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO hv_user (user_id, primary_address, display_name) VALUES (?1, ?2, ?3)",
    )
    .bind(user.userId, user.primaryAddress.toLowerCase(), user.displayName ?? null)
    .run();
}

export async function touchUser(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare("UPDATE hv_user SET last_seen_at = datetime('now') WHERE user_id = ?1")
    .bind(userId)
    .run();
}

export async function insertPasskey(
  db: D1Database,
  passkey: {
    credentialId: string;
    userId: string;
    publicKeyCose: Uint8Array;
    signCount: number;
    transports: string[] | null;
    aaguid: string | null;
    deviceLabel?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO hv_user_passkey
       (credential_id, user_id, public_key_cose, sign_count, transports_json, aaguid, device_label)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      passkey.credentialId,
      passkey.userId,
      passkey.publicKeyCose,
      passkey.signCount,
      passkey.transports ? JSON.stringify(passkey.transports) : null,
      passkey.aaguid,
      passkey.deviceLabel ?? null,
    )
    .run();
}

export async function findPasskey(
  db: D1Database,
  credentialId: string,
): Promise<HvUserPasskeyRow | null> {
  const row = await db
    .prepare("SELECT * FROM hv_user_passkey WHERE credential_id = ?1 LIMIT 1")
    .bind(credentialId)
    .first<HvUserPasskeyRow>();
  return row ?? null;
}

export async function bumpPasskeySignCount(
  db: D1Database,
  credentialId: string,
  newCount: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE hv_user_passkey
       SET sign_count = ?2, last_used_at = datetime('now')
       WHERE credential_id = ?1`,
    )
    .bind(credentialId, newCount)
    .run();
}

export async function listUserPasskeys(
  db: D1Database,
  userId: string,
): Promise<HvUserPasskeyRow[]> {
  const res = await db
    .prepare("SELECT * FROM hv_user_passkey WHERE user_id = ?1 ORDER BY created_at DESC")
    .bind(userId)
    .all<HvUserPasskeyRow>();
  return res.results ?? [];
}

// ULID minting (no extra dep). Crockford base32, 26 chars: 10-char timestamp
// + 16-char randomness. Sort-friendly, URL-safe, opaque to clients.
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function alpha(idx: number): string {
  return ULID_ALPHABET[idx]!;
}

export function ulid(now: number = Date.now()): string {
  let ts = now;
  const timePart: string[] = new Array(10);
  for (let i = 9; i >= 0; i--) {
    timePart[i] = alpha(ts % 32);
    ts = Math.floor(ts / 32);
  }
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  let randPart = "";
  for (let i = 0; i < 16; i++) {
    randPart += alpha(random[i]! % 32);
  }
  return timePart.join("") + randPart;
}
