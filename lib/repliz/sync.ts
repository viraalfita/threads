import { getStatistic, listReplizAccounts, listSchedules } from "./client";
import { insertPerformanceSnapshot } from "../analytics/store";
import { loadActiveMap } from "./settings";

export interface SyncResult {
  accountsProcessed: number;
  postsSynced: number;
  errors: string[];
}

/**
 * Pull engagement stats for published posts and append performance snapshots.
 *
 * For each connected Threads account: list succeeded schedules (they carry the
 * published `postId`), fetch each post's statistic, and store a snapshot. Runs
 * server-side (cron), so the agent never pays for this N+1 work.
 */
export async function syncReplizStats(opts?: { accountId?: string }): Promise<SyncResult> {
  const result: SyncResult = { accountsProcessed: 0, postsSynced: 0, errors: [] };

  const accounts = (await listReplizAccounts("threads")).filter((a) => a.isConnected);
  // Only sync accounts that are active (opt-in). null map = gating not enabled
  // yet (migration pending) → sync all, preserving pre-migration behavior.
  const activeMap = await loadActiveMap();
  const active = accounts.filter((a) => activeMap === null || activeMap.get(a.id) === true);
  const targets = opts?.accountId ? active.filter((a) => a.id === opts.accountId) : active;

  for (const acct of targets) {
    result.accountsProcessed++;
    let schedules;
    try {
      schedules = await listSchedules({ accountId: acct.id, status: "success" });
    } catch (e) {
      result.errors.push(`schedules ${acct.username}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const s of schedules) {
      if (!s.postId) continue;
      try {
        const stat = await getStatistic(s.postId, acct.id);
        await insertPerformanceSnapshot({
          account_id: acct.id,
          username: acct.username,
          post_id: s.postId,
          schedule_id: s.id,
          topic: s.topic ?? null,
          views: stat.views,
          likes: stat.likes,
          replies: stat.replies,
          reposts: stat.reposts,
          quotes: stat.quotes,
          shares: stat.shares,
        });
        result.postsSynced++;
      } catch (e) {
        // 403 (no insight permission) or transient — skip this post, keep going.
        result.errors.push(`stat ${acct.username}/${s.postId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return result;
}
