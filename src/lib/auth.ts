/**
 * Minimal host-only auth: a single shared password unlocks a signed,
 * HTTP-only session cookie. Edge-compatible (uses Web Crypto only).
 */

export const SESSION_COOKIE = "vb_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-change-me";
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return toBase64Url(sig);
}

/** Constant-time string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Create a signed session token: `<issuedAtSec>.<hmac>`. */
export async function createSessionToken(): Promise<string> {
  const issued = Math.floor(Date.now() / 1000).toString();
  const sig = await hmac(issued);
  return `${issued}.${sig}`;
}

/** Verify a session token's signature and freshness. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const issued = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(issued);
  if (!safeEqual(sig, expected)) return false;
  const issuedSec = Number(issued);
  if (!Number.isFinite(issuedSec)) return false;
  const ageSec = Math.floor(Date.now() / 1000) - issuedSec;
  return ageSec >= 0 && ageSec <= SESSION_MAX_AGE_SEC;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SEC,
};
