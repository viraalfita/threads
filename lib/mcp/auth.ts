import { env } from "../env";
import { supabaseAdmin } from "../supabase/server";

/**
 * Validate the Authorization header against the configured MCP bearer token.
 * Returns the bound admin's id on success, or null on failure.
 *
 * Single-user MVP: a single static bearer in env grants full admin scope. The
 * "admin" the token is bound to is just the first admin in the DB — registration
 * auto-closes after the first admin, so this is unambiguous.
 */
export async function authenticateMcpRequest(req: Request): Promise<{ adminId: string } | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const presented = match[1].trim();

  let expected: string;
  try {
    expected = env.mcpBearerToken();
  } catch {
    return null;
  }
  if (!constantTimeEqual(presented, expected)) return null;

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
