import { supabaseAdmin } from "./supabase/server";
import { decryptToken, encryptToken } from "./crypto";
import {
  getAccountInsights,
  getPostInsights,
  iterateMyPosts,
  refreshLongLivedToken,
} from "./threads/api";
import type { AppUser } from "./user";

export interface SyncResult {
  posts_seen: number;
  posts_inserted: number;
  posts_updated: number;
  insights_refreshed: number;
  account_snapshot: boolean;
  errors: string[];
}

const STALE_INSIGHTS_HOURS = 6;

export async function syncUser(user: AppUser, opts: { full?: boolean } = {}): Promise<SyncResult> {
  const db = supabaseAdmin();
  const result: SyncResult = {
    posts_seen: 0,
    posts_inserted: 0,
    posts_updated: 0,
    insights_refreshed: 0,
    account_snapshot: false,
    errors: [],
  };

  if (!user.access_token_encrypted) throw new Error("user has no access token");

  // Mark sync running ----------------------------------------
  await db.from("sync_state").upsert({
    user_id: user.id,
    status: "running",
    last_started_at: new Date().toISOString(),
    last_error: null,
  });

  try {
    let token = await ensureFreshToken(user);

    // 1. Iterate posts (initial = all, incremental = until we see known IDs)
    const knownIds = await loadKnownPostIds(user.id);

    let consecutiveKnown = 0;
    const STOP_AFTER_KNOWN = opts.full ? Infinity : 20;

    for await (const p of iterateMyPosts(token, { pageSize: 25 })) {
      result.posts_seen++;
      const isKnown = knownIds.has(p.id);

      const { data: upserted, error: upErr } = await db
        .from("posts")
        .upsert(
          {
            user_id: user.id,
            threads_post_id: p.id,
            text: p.text ?? null,
            media_type: p.media_type ?? "TEXT_POST",
            media_url: p.media_url ?? null,
            thumbnail_url: p.thumbnail_url ?? null,
            permalink: p.permalink ?? null,
            is_quote_post: p.is_quote_post ?? false,
            published_at: p.timestamp ?? new Date().toISOString(),
          },
          { onConflict: "user_id,threads_post_id" },
        )
        .select("id, last_insights_sync_at")
        .single();

      if (upErr) {
        result.errors.push(`post upsert ${p.id}: ${upErr.message}`);
        continue;
      }
      if (isKnown) result.posts_updated++;
      else result.posts_inserted++;

      // 2. Refresh insights if stale or new
      const lastSync = upserted!.last_insights_sync_at
        ? new Date(upserted!.last_insights_sync_at).getTime()
        : 0;
      const ageHours = (Date.now() - lastSync) / 36e5;
      if (!isKnown || ageHours > STALE_INSIGHTS_HOURS) {
        try {
          const ins = await getPostInsights(p.id, token);
          await db.from("post_insights").upsert({
            post_id: upserted!.id,
            views: ins.views,
            likes: ins.likes,
            replies: ins.replies,
            reposts: ins.reposts,
            quotes: ins.quotes,
            shares: ins.shares,
            snapshot_at: new Date().toISOString(),
          });
          await db.from("post_insights_history").insert({
            post_id: upserted!.id,
            views: ins.views,
            likes: ins.likes,
            replies: ins.replies,
            reposts: ins.reposts,
            quotes: ins.quotes,
            shares: ins.shares,
          });
          await db
            .from("posts")
            .update({ last_insights_sync_at: new Date().toISOString() })
            .eq("id", upserted!.id);
          result.insights_refreshed++;
        } catch (e) {
          result.errors.push(
            `insights ${p.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (isKnown) {
        consecutiveKnown++;
        if (consecutiveKnown >= STOP_AFTER_KNOWN) break;
      } else {
        consecutiveKnown = 0;
      }
    }

    // 3. Account insights snapshot
    try {
      const acc = await getAccountInsights(user.threads_user_id, token);
      await db.from("account_insights").insert({
        user_id: user.id,
        followers_count: acc.followers_count,
        views: acc.views,
        likes: acc.likes,
        replies: acc.replies,
        reposts: acc.reposts,
        quotes: acc.quotes,
      });
      result.account_snapshot = true;
    } catch (e) {
      result.errors.push(
        `account_insights: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    await db.from("sync_state").update({
      status: result.errors.length ? "failed" : "success",
      last_succeeded_at: new Date().toISOString(),
      last_error: result.errors.length ? result.errors.slice(0, 5).join("; ") : null,
      posts_synced: result.posts_seen,
      next_scheduled_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
    }).eq("user_id", user.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .from("sync_state")
      .update({ status: "failed", last_error: msg })
      .eq("user_id", user.id);
    result.errors.push(msg);
  }

  return result;
}

async function loadKnownPostIds(userId: string): Promise<Set<string>> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("posts")
    .select("threads_post_id")
    .eq("user_id", userId);
  if (error) throw new Error(`loadKnownPostIds: ${error.message}`);
  return new Set((data ?? []).map((r) => r.threads_post_id as string));
}

/**
 * Refresh the long-lived token if it's within 7 days of expiry.
 * Threads tokens are 60 days, refreshable any time after 24h.
 */
async function ensureFreshToken(user: AppUser): Promise<string> {
  const token = decryptToken(user.access_token_encrypted!);
  if (!user.token_expires_at) return token;
  const msToExpiry = new Date(user.token_expires_at).getTime() - Date.now();
  if (msToExpiry > 7 * 24 * 3600_000) return token;
  try {
    const refreshed = await refreshLongLivedToken(token);
    const db = supabaseAdmin();
    await db
      .from("users")
      .update({
        access_token_encrypted: encryptToken(refreshed.access_token),
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("id", user.id);
    return refreshed.access_token;
  } catch {
    // Token may not be refreshable yet (<24h old). Use existing.
    return token;
  }
}
