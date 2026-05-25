import { NextRequest, NextResponse } from "next/server";
import { insertClient } from "@/lib/oauth/store";
import { generateToken } from "@/lib/oauth/issuer";

export const dynamic = "force-dynamic";

/**
 * Dynamic Client Registration (RFC 7591).
 * Open registration: any caller (including claude.ai) may register a client.
 * The client_id is a random opaque string; we issue no client_secret because
 * claude.ai uses PKCE (public client).
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Body must be JSON." },
      { status: 400 },
    );
  }

  const redirectUris: unknown = body?.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris[] is required." },
      { status: 400 },
    );
  }
  for (const u of redirectUris) {
    if (typeof u !== "string" || !/^https?:\/\//.test(u)) {
      return NextResponse.json(
        { error: "invalid_redirect_uri", error_description: `Bad redirect_uri: ${u}` },
        { status: 400 },
      );
    }
  }

  const clientId = generateToken(16);
  const grantTypes: string[] = Array.isArray(body?.grant_types) && body.grant_types.length
    ? body.grant_types.filter((g: unknown) => typeof g === "string")
    : ["authorization_code"];
  const responseTypes: string[] = Array.isArray(body?.response_types) && body.response_types.length
    ? body.response_types.filter((r: unknown) => typeof r === "string")
    : ["code"];
  const tokenAuthMethod = typeof body?.token_endpoint_auth_method === "string"
    ? body.token_endpoint_auth_method
    : "none";
  const clientName = typeof body?.client_name === "string" ? body.client_name : null;
  const scope = typeof body?.scope === "string" ? body.scope : "mcp";

  const client = await insertClient({
    client_id: clientId,
    client_secret: null, // public client + PKCE
    client_name: clientName,
    redirect_uris: redirectUris as string[],
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: tokenAuthMethod,
    scope,
  });

  return NextResponse.json(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(new Date(client.created_at).getTime() / 1000),
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      client_name: client.client_name,
      scope: client.scope,
    },
    { status: 201 },
  );
}
