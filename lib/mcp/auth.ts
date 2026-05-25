import { env } from "../env";
import { supabaseAdmin } from "../supabase/server";
import { getToken } from "../oauth/store";

/**
 * Validate the Authorization header for an MCP request.
 *
 * Accepts two token types:
 *  1. OAuth 2.0 access token (issued via /api/oauth/token) — preferred path, used
 *     by claude.ai Connectors. Looked up in `oauth_tokens`.
 *  2. Static `MCP_BEARER_TOKEN` from env — fallback for tools that talk MCP
 *     directly (Claude Code, scripts, curl). Bound to the first admin.
 *
 * Returns the resolved adminId on success, or null otherwise.
 */
export async function authenticateMcpRequest(req: Request): Promise<{ adminId: string } | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const presented = match[1].trim();

  // 1. Try OAuth access token first.
  try {
    const token = await getToken(presented);
    if (token) return { adminId: token.admin_id };
  } catch {
    // Fall through to static bearer.
  }

  // 2. Fall back to the static env bearer (single-user dev convenience).
  let staticToken: string | null = null;
  try {
    staticToken = env.mcpBearerToken();
  } catch {
    staticToken = null;
  }
  if (staticToken && constantTimeEqual(presented, staticToken)) {
    return resolveDefaultAdmin();
  }

  return null;
}

async function resolveDefaultAdmin(): Promise<{ adminId: string } | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("admins")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { adminId: data.id as string };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
