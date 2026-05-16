// Cookie names + write/clear helpers. Centralized so the security attrs
// can't drift between routes.
//
// hv_reg     — short-lived ceremonyId held during an in-flight WebAuthn
//              ceremony. HttpOnly + SameSite=Strict + Path=/api/auth.
// hv_session — long-lived JWT session token. HttpOnly + Secure (in prod) +
//              SameSite=Lax + Path=/. 30-day Max-Age.

export const HV_REG_COOKIE = "hv_reg";
export const HV_SESSION_COOKIE = "hv_session";

export const REG_COOKIE_MAX_AGE = 5 * 60;             // 5 min
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const isProd = process.env.NODE_ENV === "production";

export interface SetCookieOptions {
  maxAge: number;
  path: string;
  sameSite: "lax" | "strict";
  httpOnly: boolean;
  secure: boolean;
}

export function regCookieOptions(): SetCookieOptions {
  return {
    maxAge: REG_COOKIE_MAX_AGE,
    path: "/api/auth",
    sameSite: "strict",
    httpOnly: true,
    secure: isProd,
  };
}

export function sessionCookieOptions(): SetCookieOptions {
  return {
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: isProd,
  };
}

export function clearCookieOptions(path: string): SetCookieOptions {
  return {
    maxAge: 0,
    path,
    sameSite: "lax",
    httpOnly: true,
    secure: isProd,
  };
}
