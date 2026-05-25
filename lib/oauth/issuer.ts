import { env } from "../env";
import { randomBytes, createHash } from "crypto";

/** Base URL used in OAuth metadata + redirects. Configured via NEXT_PUBLIC_APP_URL. */
export function issuerUrl(): string {
  // Strip trailing slash so we can concatenate paths cleanly.
  return env.appUrl().replace(/\/+$/, "");
}

export function metadataUrl(path: string): string {
  return `${issuerUrl()}${path}`;
}

/** Cryptographically random URL-safe identifier (base64url, no padding). */
export function generateToken(byteLength: number = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** Verify a PKCE code_verifier matches a previously stored S256 code_challenge. */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  // Lengths are fixed, so a plain compare is fine; PKCE values are not secrets.
  return computed === challenge;
}

/** Access token lifetime (seconds). Long-lived since refresh isn't implemented yet. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
/** Auth code lifetime (seconds). */
export const AUTH_CODE_TTL_SECONDS = 60 * 5; // 5 minutes
