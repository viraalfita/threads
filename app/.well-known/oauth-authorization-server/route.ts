import { NextResponse } from "next/server";
import { issuerUrl, metadataUrl } from "@/lib/oauth/issuer";

export const dynamic = "force-dynamic";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 * Served at the well-known location so clients (claude.ai) can discover the
 * authorize / token / register endpoints automatically.
 */
export async function GET() {
  return NextResponse.json({
    issuer: issuerUrl(),
    authorization_endpoint: metadataUrl("/api/oauth/authorize"),
    token_endpoint: metadataUrl("/api/oauth/token"),
    registration_endpoint: metadataUrl("/api/oauth/register"),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp"],
  });
}
