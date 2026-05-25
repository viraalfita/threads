import { NextRequest, NextResponse } from "next/server";
import { consumeCode, getClient, insertToken } from "@/lib/oauth/store";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateToken,
  verifyPkceS256,
} from "@/lib/oauth/issuer";

export const dynamic = "force-dynamic";

/**
 * OAuth 2.0 Token Endpoint (RFC 6749 §3.2). Only authorization_code grant is
 * implemented; refresh isn't (tokens are long-lived).
 *
 * Accepts both application/x-www-form-urlencoded (per spec) and JSON (some
 * clients including claude.ai may send JSON).
 */
export async function POST(req: NextRequest) {
  const params = await readParams(req);

  const grantType = params.get("grant_type");
  if (grantType !== "authorization_code") {
    return tokenError("unsupported_grant_type", `grant_type=${grantType} is not supported.`);
  }

  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  const codeVerifier = params.get("code_verifier");
  const clientId = params.get("client_id") ?? extractBasicClientId(req);

  if (!code) return tokenError("invalid_request", "code is required");
  if (!redirectUri) return tokenError("invalid_request", "redirect_uri is required");
  if (!codeVerifier) return tokenError("invalid_request", "code_verifier is required (PKCE)");
  if (!clientId) return tokenError("invalid_client", "client_id is required");

  const client = await getClient(clientId);
  if (!client) return tokenError("invalid_client", "Unknown client_id");

  const consumed = await consumeCode(code);
  if (!consumed) {
    return tokenError("invalid_grant", "Authorization code is invalid, expired, or already used.");
  }
  if (consumed.client_id !== clientId) {
    return tokenError("invalid_grant", "Code was not issued to this client.");
  }
  if (consumed.redirect_uri !== redirectUri) {
    return tokenError("invalid_grant", "redirect_uri does not match the one used at authorize.");
  }
  if (!verifyPkceS256(codeVerifier, consumed.code_challenge)) {
    return tokenError("invalid_grant", "PKCE verification failed.");
  }

  const accessToken = generateToken(32);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
  await insertToken({
    access_token: accessToken,
    refresh_token: null,
    client_id: clientId,
    admin_id: consumed.admin_id,
    scope: consumed.scope,
    expires_at: expiresAt.toISOString(),
  });

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: consumed.scope,
    },
    {
      headers: {
        "cache-control": "no-store",
        pragma: "no-cache",
      },
    },
  );
}

async function readParams(req: NextRequest): Promise<URLSearchParams> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = await req.json();
      const out = new URLSearchParams();
      for (const [k, v] of Object.entries(body ?? {})) {
        if (typeof v === "string") out.set(k, v);
      }
      return out;
    } catch {
      return new URLSearchParams();
    }
  }
  // Default: form-encoded per RFC 6749.
  const text = await req.text();
  return new URLSearchParams(text);
}

function extractBasicClientId(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = /^Basic\s+(.+)$/i.exec(auth);
  if (!m) return null;
  try {
    const decoded = Buffer.from(m[1], "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    return idx > 0 ? decoded.slice(0, idx) : null;
  } catch {
    return null;
  }
}

function tokenError(code: string, description: string): NextResponse {
  return NextResponse.json(
    { error: code, error_description: description },
    { status: 400, headers: { "cache-control": "no-store" } },
  );
}
