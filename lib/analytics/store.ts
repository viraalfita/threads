import { supabaseAdmin } from "../supabase/server";

export interface PerformanceSnapshot {
  account_id: string;
  username?: string | null;
  post_id: string;
  schedule_id?: string | null;
  topic?: string | null;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

function engagementRate(s: { views: number; likes: number; replies: number; reposts: number; quotes: number; shares: number }): number {
  if (s.views <= 0) return 0;
  return (s.likes + s.replies + s.reposts + s.quotes + s.shares) / s.views;
}

export async function insertPerformanceSnapshot(s: PerformanceSnapshot): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("repliz_post_performance").insert({
    account_id: s.account_id,
    username: s.username ?? null,
    post_id: s.post_id,
    schedule_id: s.schedule_id ?? null,
    topic: s.topic ?? null,
    views: s.views,
    likes: s.likes,
    replies: s.replies,
    reposts: s.reposts,
    quotes: s.quotes,
    shares: s.shares,
    engagement_rate: engagementRate(s),
  });
  if (error) throw new Error(`insertPerformanceSnapshot: ${error.message}`);
}

export interface PostSummaryRow {
  post_id: string;
  topic: string | null;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  engagement_rate: number;
  snapshot_at: string;
}

/**
 * Latest snapshot per post for an account within the lookback window, sorted by
 * engagement rate descending. Powers `account_summary` and learning analysis.
 */
export async function getLatestPerformance(
  accountId: string,
  periodDays: number = 30,
): Promise<PostSummaryRow[]> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("repliz_post_performance")
    .select("post_id, topic, views, likes, replies, reposts, quotes, shares, engagement_rate, snapshot_at")
    .eq("account_id", accountId)
    .gte("snapshot_at", since)
    .order("snapshot_at", { ascending: false });
  if (error) throw new Error(`getLatestPerformance: ${error.message}`);

  // Collapse to the most recent snapshot per post_id (rows already desc by time).
  const latest = new Map<string, PostSummaryRow>();
  for (const r of (data ?? []) as any[]) {
    if (!latest.has(r.post_id)) {
      latest.set(r.post_id, {
        post_id: r.post_id,
        topic: r.topic ?? null,
        views: Number(r.views),
        likes: Number(r.likes),
        replies: Number(r.replies),
        reposts: Number(r.reposts),
        quotes: Number(r.quotes),
        shares: Number(r.shares),
        engagement_rate: Number(r.engagement_rate),
        snapshot_at: r.snapshot_at,
      });
    }
  }
  return [...latest.values()].sort((a, b) => b.engagement_rate - a.engagement_rate);
}

export interface LearningRow {
  week: string;
  summary: string;
  patterns: Record<string, unknown>;
  created_at: string;
}

export async function getLearnings(accountId: string, limit: number = 8): Promise<LearningRow[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("repliz_learnings")
    .select("week, summary, patterns, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getLearnings: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    week: r.week,
    summary: r.summary,
    patterns: r.patterns ?? {},
    created_at: r.created_at,
  }));
}

export async function saveLearning(input: {
  accountId: string;
  username?: string | null;
  week: string;
  summary: string;
  patterns?: Record<string, unknown>;
}): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("repliz_learnings").insert({
    account_id: input.accountId,
    username: input.username ?? null,
    week: input.week,
    summary: input.summary,
    patterns: input.patterns ?? {},
  });
  if (error) throw new Error(`saveLearning: ${error.message}`);
}
