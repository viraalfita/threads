import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase/server";
import { decryptToken } from "./crypto";
import { getSession } from "./session";

export interface AppUser {
  id: string;
  admin_id: string;
  threads_user_id: string;
  username: string | null;
  name: string | null;
  threads_profile_picture_url: string | null;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
}

export const ACTIVE_ACCOUNT_COOKIE = "threadlens_active_account";

/**
 * List all Threads accounts connected by the current session's admin.
 */
export async function listMyAccounts(): Promise<AppUser[]> {
  const session = await getSession();
  if (!session) return [];
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("admin_id", session.sub)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listMyAccounts: ${error.message}`);
  return (data ?? []) as AppUser[];
}

/**
 * Returns the "active" Threads account for this session, or null if none connected.
 * Active is determined by cookie; falls back to most-recently-updated if cookie is unset/invalid.
 */
export async function getActiveUser(): Promise<AppUser | null> {
  const accounts = await listMyAccounts();
  if (accounts.length === 0) return null;
  const cookieId = cookies().get(ACTIVE_ACCOUNT_COOKIE)?.value;
  if (cookieId) {
    const match = accounts.find((a) => a.id === cookieId);
    if (match) return match;
  }
  return accounts[0];
}

export async function getActiveUserToken(): Promise<{ user: AppUser; token: string }> {
  const user = await getActiveUser();
  if (!user) throw new Error("No active Threads account. Visit /settings to connect.");
  if (!user.access_token_encrypted) throw new Error("Access token missing. Reconnect this account.");
  return { user, token: decryptToken(user.access_token_encrypted) };
}

/** @deprecated use getActiveUser() */
export const getCurrentUser = getActiveUser;
/** @deprecated use getActiveUserToken() */
export const getCurrentUserToken = getActiveUserToken;
