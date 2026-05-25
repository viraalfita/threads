import type { AppUser } from "../user";
import { supabaseAdmin } from "../supabase/server";
import { decryptToken } from "../crypto";

/**
 * List Threads accounts connected by the given admin, oldest-first so that
 * `[0]` is the deterministic default account (Option A: first account created).
 */
export async function listAccountsForAdmin(adminId: string): Promise<AppUser[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listAccountsForAdmin: ${error.message}`);
  return (data ?? []) as AppUser[];
}

/**
 * Resolve a `username` (case-insensitive, optionally prefixed with `@`) to one
 * of the admin's connected accounts. If `username` is empty/undefined, returns
 * the default account (the first-created one).
 */
export async function resolveAccount(
  adminId: string,
  username?: string | null,
): Promise<AppUser> {
  const accounts = await listAccountsForAdmin(adminId);
  if (accounts.length === 0) {
    throw new Error("No Threads accounts connected. Visit /settings to connect one first.");
  }

  const cleaned = (username ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!cleaned) return accounts[0];

  const match = accounts.find((a) => (a.username ?? "").toLowerCase() === cleaned);
  if (!match) {
    const known = accounts.map((a) => a.username ?? "(no username)").join(", ");
    throw new Error(`Account "${username}" not connected. Known accounts: ${known}`);
  }
  return match;
}

/**
 * Resolve an account and return its decrypted Threads access token, or throw
 * with a clear message if the token is missing or expired.
 */
export async function resolveAccountWithToken(
  adminId: string,
  username?: string | null,
): Promise<{ user: AppUser; token: string }> {
  const user = await resolveAccount(adminId, username);
  if (!user.access_token_encrypted) {
    throw new Error(`Account "${user.username}" has no access token. Reconnect it via /settings.`);
  }
  return { user, token: decryptToken(user.access_token_encrypted) };
}
