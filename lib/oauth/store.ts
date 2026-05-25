import { supabaseAdmin } from "../supabase/server";

export interface OAuthClient {
  client_id: string;
  client_secret: string | null;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string | null;
  created_at: string;
}

export interface OAuthCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  admin_id: string;
  scope: string | null;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: string;
  used: boolean;
}

export interface OAuthToken {
  access_token: string;
  refresh_token: string | null;
  client_id: string;
  admin_id: string;
  scope: string | null;
  expires_at: string;
}

export async function insertClient(client: Omit<OAuthClient, "created_at">): Promise<OAuthClient> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("oauth_clients").insert(client).select().single();
  if (error) throw new Error(`insertClient: ${error.message}`);
  return data as OAuthClient;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("oauth_clients")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`getClient: ${error.message}`);
  return (data as OAuthClient | null) ?? null;
}

export async function insertCode(code: Omit<OAuthCode, "used">): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("oauth_codes").insert({ ...code, used: false });
  if (error) throw new Error(`insertCode: ${error.message}`);
}

/**
 * Atomically consume an authorization code: mark used and return its row.
 * Returns null if the code doesn't exist, was already used, or is expired.
 */
export async function consumeCode(code: string): Promise<OAuthCode | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("oauth_codes")
    .update({ used: true })
    .eq("code", code)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .select()
    .maybeSingle();
  if (error) throw new Error(`consumeCode: ${error.message}`);
  return (data as OAuthCode | null) ?? null;
}

export async function insertToken(token: OAuthToken): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("oauth_tokens").insert(token);
  if (error) throw new Error(`insertToken: ${error.message}`);
}

export async function getToken(accessToken: string): Promise<OAuthToken | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("oauth_tokens")
    .select("*")
    .eq("access_token", accessToken)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`getToken: ${error.message}`);
  return (data as OAuthToken | null) ?? null;
}
