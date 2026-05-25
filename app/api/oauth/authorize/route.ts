import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getClient, insertCode } from "@/lib/oauth/store";
import { generateToken, AUTH_CODE_TTL_SECONDS } from "@/lib/oauth/issuer";

export const dynamic = "force-dynamic";

/**
 * OAuth 2.0 Authorization Endpoint (RFC 6749 §3.1) + PKCE (RFC 7636).
 *
 * Single-user MVP: if the admin already has an active session cookie, we
 * silently grant (no consent screen). If not, bounce them to /login with a
 * `next` param that brings them back here.
 *
 * On success: 302 redirect to client's redirect_uri with code + state.
 * On client/PKCE errors: render a plain error page (cannot redirect since the
 * client isn't validated yet).
 * On user-related errors (after client validated): redirect to client with
 * `error` param per spec.
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  const clientId = u.searchParams.get("client_id");
  const redirectUri = u.searchParams.get("redirect_uri");
  const responseType = u.searchParams.get("response_type");
  const state = u.searchParams.get("state");
  const codeChallenge = u.searchParams.get("code_challenge");
  const codeChallengeMethod = u.searchParams.get("code_challenge_method") ?? "S256";
  const scope = u.searchParams.get("scope");

  if (!clientId) return errorPage("Missing client_id");
  const client = await getClient(clientId);
  if (!client) return errorPage(`Unknown client_id: ${clientId}`);

  if (!redirectUri) return errorPage("Missing redirect_uri");
  if (!client.redirect_uris.includes(redirectUri)) {
    return errorPage(`redirect_uri not registered for this client: ${redirectUri}`);
  }

  // From here on, errors get reported by redirect (per spec).
  const errorRedirect = (code: string, description: string) => {
    const back = new URL(redirectUri);
    back.searchParams.set("error", code);
    back.searchParams.set("error_description", description);
    if (state) back.searchParams.set("state", state);
    return NextResponse.redirect(back);
  };

  if (responseType !== "code") {
    return errorRedirect("unsupported_response_type", "Only response_type=code is supported.");
  }
  if (!codeChallenge) {
    return errorRedirect("invalid_request", "PKCE code_challenge is required.");
  }
  if (codeChallengeMethod !== "S256") {
    return errorRedirect("invalid_request", "Only S256 PKCE method is supported.");
  }

  const session = await getSession();
  if (!session) {
    // Bounce through /login; we preserve the original querystring via `next`.
    const loginUrl = new URL("/login", u.origin);
    loginUrl.searchParams.set("next", `${u.pathname}?${u.searchParams.toString()}`);
    return NextResponse.redirect(loginUrl);
  }

  const code = generateToken(32);
  await insertCode({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    admin_id: session.sub,
    scope: scope ?? client.scope ?? "mcp",
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(),
  });

  const back = new URL(redirectUri);
  back.searchParams.set("code", code);
  if (state) back.searchParams.set("state", state);
  return NextResponse.redirect(back);
}

function errorPage(message: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>OAuth error</title></head>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:1rem">
<h1>OAuth error</h1><p>${escapeHtml(message)}</p>
</body></html>`;
  return new Response(html, { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
