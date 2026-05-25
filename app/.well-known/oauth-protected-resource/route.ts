import { NextResponse } from "next/server";
import { issuerUrl, metadataUrl } from "@/lib/oauth/issuer";

export const dynamic = "force-dynamic";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 * MCP clients use this to find the authorization server for a given resource.
 * The resource is the MCP endpoint URL.
 */
export async function GET() {
  return NextResponse.json({
    resource: metadataUrl("/api/mcp"),
    authorization_servers: [issuerUrl()],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
  });
}
