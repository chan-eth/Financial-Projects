// /auth/* routes — passkey ceremony + session lifecycle.
//
// Flow:
//   POST /auth/passkey/register/start  { primaryAddress, displayName? }
//     → { options, ceremonyId }        ceremonyId travels back on /verify
//
//   POST /auth/passkey/register/verify { ceremonyId, response, deviceLabel? }
//     → { user, sessionToken }         sessionToken = HS256 JWT
//
//   POST /auth/passkey/login/start
//     → { options, ceremonyId }
//
//   POST /auth/passkey/login/verify    { ceremonyId, response }
//     → { user, sessionToken }
//
//   POST /auth/logout                  (auth: user)
//     → 204     // Stateless tokens — client just discards the cookie.
//
//   GET /auth/me                       (auth: user)
//     → { user, passkeys: [{credentialId, deviceLabel, createdAt, lastUsedAt}] }

import { z } from "zod";
import type { AuthContext } from "../auth.js";
import type { Env } from "../env.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../errors.js";
import {
  storeCeremony,
  takeCeremony,
  type PendingRegistration,
  type PendingLogin,
} from "../services/challenge-store.js";
import {
  createRegistrationOptions,
  verifyRegistration,
  createAuthenticationOptions,
  verifyAuthentication,
  type RpConfig,
} from "../services/passkey.js";
import { issueSession } from "../services/session.js";
import {
  bumpPasskeySignCount,
  createUser,
  findPasskey,
  findUserByAddress,
  findUserById,
  insertPasskey,
  listUserPasskeys,
  touchUser,
  ulid,
} from "../services/user-store.js";

const AddressString = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "primaryAddress must be a 0x-prefixed 20-byte hex");

const RegisterStartBody = z.object({
  primaryAddress: AddressString,
  displayName: z.string().min(1).max(60).optional(),
});

const RegisterVerifyBody = z.object({
  ceremonyId: z.string().uuid(),
  response: z.unknown(), // @simplewebauthn validates internally
  deviceLabel: z.string().min(1).max(60).optional(),
});

const LoginVerifyBody = z.object({
  ceremonyId: z.string().uuid(),
  response: z.unknown(),
});

export async function handleAuth(
  request: Request,
  env: Env,
  url: URL,
  authCtx: AuthContext | null,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const rp = readRpConfig(env);

  // ---- register ------------------------------------------------------------
  if (path === "/auth/passkey/register/start" && method === "POST") {
    const body = RegisterStartBody.parse(await safeJson(request));
    const primaryAddress = body.primaryAddress.toLowerCase();
    if (await findUserByAddress(env.DB, primaryAddress)) {
      throw new BadRequestError("address already registered; use login");
    }
    const userIdToCreate = ulid();
    const options = await createRegistrationOptions({
      rp,
      userId: userIdToCreate,
      userName: primaryAddress,
      userDisplayName: body.displayName ?? primaryAddress.slice(0, 10),
    });
    const pending: PendingRegistration = {
      type: "register",
      challenge: options.challenge,
      userIdToCreate,
      primaryAddress,
      displayName: body.displayName,
      createdAt: Math.floor(Date.now() / 1000),
    };
    const ceremonyId = await storeCeremony(env.HV_CHALLENGES, pending);
    return json({ options, ceremonyId });
  }

  if (path === "/auth/passkey/register/verify" && method === "POST") {
    const body = RegisterVerifyBody.parse(await safeJson(request));
    const ceremony = await takeCeremony(env.HV_CHALLENGES, body.ceremonyId);
    if (!ceremony || ceremony.type !== "register") {
      throw new BadRequestError("ceremony not found or wrong type");
    }
    // Race: another tab might have registered this address while we were waiting.
    if (await findUserByAddress(env.DB, ceremony.primaryAddress)) {
      throw new BadRequestError("address registered concurrently; retry as login");
    }
    let verified;
    try {
      verified = await verifyRegistration({
        rp,
        expectedChallenge: ceremony.challenge,
          response: body.response as never,
      });
    } catch (err) {
      throw new BadRequestError("attestation verification failed", { cause: String(err) });
    }
    if (!verified.verified || !verified.registrationInfo) {
      throw new BadRequestError("attestation rejected");
    }
    const cred = verified.registrationInfo.credential;
    await createUser(env.DB, {
      userId: ceremony.userIdToCreate,
      primaryAddress: ceremony.primaryAddress,
      displayName: ceremony.displayName ?? null,
    });
    await insertPasskey(env.DB, {
      credentialId: cred.id,
      userId: ceremony.userIdToCreate,
      publicKeyCose: cred.publicKey,
      signCount: cred.counter,
      transports: cred.transports ?? null,
      aaguid: verified.registrationInfo.aaguid ?? null,
      deviceLabel: body.deviceLabel ?? null,
    });
    const { token } = await issueSession(
      ceremony.userIdToCreate,
      requireSigningSecret(env),
    );
    const user = await findUserById(env.DB, ceremony.userIdToCreate);
    return json({ user: redactUser(user!), sessionToken: token });
  }

  // ---- login ---------------------------------------------------------------
  if (path === "/auth/passkey/login/start" && method === "POST") {
    const options = await createAuthenticationOptions(rp);
    const pending: PendingLogin = {
      type: "login",
      challenge: options.challenge,
      createdAt: Math.floor(Date.now() / 1000),
    };
    const ceremonyId = await storeCeremony(env.HV_CHALLENGES, pending);
    return json({ options, ceremonyId });
  }

  if (path === "/auth/passkey/login/verify" && method === "POST") {
    const body = LoginVerifyBody.parse(await safeJson(request));
    const ceremony = await takeCeremony(env.HV_CHALLENGES, body.ceremonyId);
    if (!ceremony || ceremony.type !== "login") {
      throw new BadRequestError("ceremony not found or wrong type");
    }
    // The browser puts the credential id in `response.id`; look it up.
    const resp = body.response as { id?: string };
    if (!resp.id || typeof resp.id !== "string") {
      throw new BadRequestError("response missing credential id");
    }
    const stored = await findPasskey(env.DB, resp.id);
    if (!stored) throw new UnauthorizedError("unknown passkey");

    let verified;
    try {
      verified = await verifyAuthentication({
        rp,
        expectedChallenge: ceremony.challenge,
        response: body.response as never,
        storedCredential: {
          id: stored.credential_id,
          publicKey: stored.public_key_cose,
          counter: stored.sign_count,
          transports: stored.transports_json
            ? (JSON.parse(stored.transports_json) as AuthenticatorTransportFutureLike[])
            : undefined,
        },
      });
    } catch (err) {
      throw new UnauthorizedError(`authentication failed: ${String(err)}`);
    }
    if (!verified.verified) throw new UnauthorizedError("authentication rejected");

    await bumpPasskeySignCount(
      env.DB,
      stored.credential_id,
      verified.authenticationInfo.newCounter,
    );
    await touchUser(env.DB, stored.user_id);
    const { token } = await issueSession(stored.user_id, requireSigningSecret(env));
    const user = await findUserById(env.DB, stored.user_id);
    return json({ user: redactUser(user!), sessionToken: token });
  }

  // ---- session-bound -------------------------------------------------------
  if (path === "/auth/logout" && method === "POST") {
    if (!authCtx || authCtx.scope !== "user") throw new UnauthorizedError();
    // Stateless: nothing to revoke server-side. Client discards the cookie.
    return new Response(null, { status: 204 });
  }

  if (path === "/auth/me" && method === "GET") {
    if (!authCtx || authCtx.scope !== "user" || !authCtx.userId) {
      throw new UnauthorizedError();
    }
    const user = await findUserById(env.DB, authCtx.userId);
    if (!user) throw new NotFoundError("user not found");
    const passkeys = await listUserPasskeys(env.DB, user.user_id);
    return json({
      user: redactUser(user),
      passkeys: passkeys.map((p) => ({
        credentialId: p.credential_id,
        deviceLabel: p.device_label,
        createdAt: p.created_at,
        lastUsedAt: p.last_used_at,
      })),
    });
  }

  throw new NotFoundError();
}

// ---- helpers ----------------------------------------------------------------

function readRpConfig(env: Env): RpConfig {
  if (!env.RP_ID || !env.RP_ORIGIN) {
    throw new Error("RP_ID and RP_ORIGIN must be set in worker env");
  }
  return {
    rpId: env.RP_ID,
    rpName: env.RP_NAME ?? "HyperView",
    origin: env.RP_ORIGIN,
  };
}

function requireSigningSecret(env: Env): string {
  if (!env.SESSION_SIGNING_SECRET || env.SESSION_SIGNING_SECRET.length < 32) {
    throw new Error("SESSION_SIGNING_SECRET must be set (>=32 chars)");
  }
  return env.SESSION_SIGNING_SECRET;
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError("body must be valid JSON");
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function redactUser(user: {
  user_id: string;
  primary_address: string;
  display_name: string | null;
  entitlement_tier: string;
}) {
  return {
    userId: user.user_id,
    primaryAddress: user.primary_address,
    displayName: user.display_name,
    entitlementTier: user.entitlement_tier,
  };
}

// Local alias so the auth.ts file doesn't need to re-export @simplewebauthn types.
type AuthenticatorTransportFutureLike =
  | "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";
