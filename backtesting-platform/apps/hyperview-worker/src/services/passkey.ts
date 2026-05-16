// WebAuthn ceremony helpers — thin wrappers over @simplewebauthn/server so
// the route layer stays focused on HTTP shape, not WebAuthn intricacies.
//
// Relying-Party config (rpId, rpName, origin) is read from env per request
// so the same code works across localhost (dev), staging, and prod.

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";

export interface RpConfig {
  rpId: string;     // hyperview.xyz | staging.hyperview.xyz | localhost
  rpName: string;   // "HyperView"
  origin: string;   // https://hyperview.xyz | http://localhost:3000
}

export async function createRegistrationOptions(args: {
  rp: RpConfig;
  userId: string;
  userName: string;       // human-readable handle (we use primaryAddress)
  userDisplayName: string;
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return generateRegistrationOptions({
    rpName: args.rp.rpName,
    rpID: args.rp.rpId,
    userID: new TextEncoder().encode(args.userId),
    userName: args.userName,
    userDisplayName: args.userDisplayName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    // ES256 (-7) is the universal default; RS256 (-257) as fallback.
    supportedAlgorithmIDs: [-7, -257],
  });
}

export async function verifyRegistration(args: {
  rp: RpConfig;
  expectedChallenge: string;
  response: RegistrationResponseJSON;
}): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    response: args.response,
    expectedChallenge: args.expectedChallenge,
    expectedOrigin: args.rp.origin,
    expectedRPID: args.rp.rpId,
    requireUserVerification: true,
  });
}

export async function createAuthenticationOptions(
  rp: RpConfig,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  // Discoverable credentials: omit `allowCredentials` so the authenticator
  // can surface any matching passkey it holds.
  return generateAuthenticationOptions({
    rpID: rp.rpId,
    userVerification: "required",
  });
}

export async function verifyAuthentication(args: {
  rp: RpConfig;
  expectedChallenge: string;
  response: AuthenticationResponseJSON;
  storedCredential: {
    id: string;                                // base64url
    publicKey: Uint8Array;
    counter: number;
    transports: AuthenticatorTransportFuture[] | undefined;
  };
}): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response: args.response,
    expectedChallenge: args.expectedChallenge,
    expectedOrigin: args.rp.origin,
    expectedRPID: args.rp.rpId,
    credential: {
      id: args.storedCredential.id,
      publicKey: args.storedCredential.publicKey,
      counter: args.storedCredential.counter,
      transports: args.storedCredential.transports,
    },
    requireUserVerification: true,
  });
}
