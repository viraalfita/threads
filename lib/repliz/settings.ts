import { supabaseAdmin } from "../supabase/server";

/**
 * Per-account activation state. Reads degrade gracefully: if the
 * `repliz_accounts` table doesn't exist yet (migration not applied), the
 * loaders return null so callers fall back to pre-gating behavior instead of
 * breaking. Once the table exists, activation is enforced (opt-in).
 */

/** Map of account_id → is_active. Returns null if the table is unavailable. */
export async function loadActiveMap(): Promise<Map<string, boolean> | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("repliz_accounts").select("account_id, is_active");
  if (error) return null; // table missing or unreadable → gating not yet enabled
  const map = new Map<string, boolean>();
  for (const r of (data ?? []) as any[]) map.set(r.account_id, Boolean(r.is_active));
  return map;
}

/**
 * Whether an account may be used for schedule/publish.
 * - table missing (map null) → true (pre-migration: don't block)
 * - table present, row active → true
 * - table present, no row or inactive → false
 */
export async function isAccountUsable(accountId: string): Promise<boolean> {
  const map = await loadActiveMap();
  if (map === null) return true;
  return map.get(accountId) === true;
}

export interface AccountSetting {
  account_id: string;
  username: string | null;
  is_active: boolean;
  niche: string | null;
}

/** Full per-account setting row, or null if unavailable / not yet recorded. */
export async function getAccountSetting(accountId: string): Promise<AccountSetting | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("repliz_accounts")
    .select("account_id, username, is_active, niche")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return {
    account_id: data.account_id as string,
    username: (data.username as string) ?? null,
    is_active: Boolean(data.is_active),
    niche: (data.niche as string) ?? null,
  };
}

export async function setAccountActive(
  accountId: string,
  username: string | null,
  active: boolean,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("repliz_accounts")
    .upsert({ account_id: accountId, username, is_active: active }, { onConflict: "account_id" });
  if (error) throw new Error(`setAccountActive: ${error.message}`);
}
