import { supabaseAdmin } from "./supabase/server";

export interface PostRow {
  id: string;
  threads_post_id: string;
  text: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  is_quote_post: boolean;
  published_at: string;
  insights: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    shares: number;
    engagement_rate: number;
  } | null;
}

export async function listPosts(userId: string, opts: { limit?: number; sinceDays?: number } = {}): Promise<PostRow[]> {
  const db = supabaseAdmin();
  const q = db
    .from("posts")
    .select(
      "id, threads_post_id, text, media_type, media_url, thumbnail_url, permalink, is_quote_post, published_at, post_insights ( views, likes, replies, reposts, quotes, shares, engagement_rate )",
    )
    .eq("user_id", userId)
    .order("published_at", { ascending: false });
  if (opts.sinceDays) {
    q.gte("published_at", new Date(Date.now() - opts.sinceDays * 86400_000).toISOString());
  }
  if (opts.limit) q.limit(opts.limit);
  const { data, error } = await q;
  console.log(`[listPosts] userId=${userId} rows=${data?.length ?? 0} error=${error?.message ?? "none"}`);
  if (error) throw new Error(`listPosts: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    threads_post_id: r.threads_post_id,
    text: r.text,
    media_type: r.media_type,
    media_url: r.media_url,
    thumbnail_url: r.thumbnail_url,
    permalink: r.permalink,
    is_quote_post: r.is_quote_post,
    published_at: r.published_at,
    insights: r.post_insights
      ? {
          views: r.post_insights.views ?? 0,
          likes: r.post_insights.likes ?? 0,
          replies: r.post_insights.replies ?? 0,
          reposts: r.post_insights.reposts ?? 0,
          quotes: r.post_insights.quotes ?? 0,
          shares: r.post_insights.shares ?? 0,
          engagement_rate: Number(r.post_insights.engagement_rate ?? 0),
        }
      : null,
  }));
}

export async function getPost(userId: string, postId: string): Promise<PostRow | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("posts")
    .select(
      "id, threads_post_id, text, media_type, media_url, thumbnail_url, permalink, is_quote_post, published_at, post_insights ( views, likes, replies, reposts, quotes, shares, engagement_rate )",
    )
    .eq("user_id", userId)
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(`getPost: ${error.message}`);
  if (!data) return null;
  const r: any = data;
  return {
    id: r.id,
    threads_post_id: r.threads_post_id,
    text: r.text,
    media_type: r.media_type,
    media_url: r.media_url,
    thumbnail_url: r.thumbnail_url,
    permalink: r.permalink,
    is_quote_post: r.is_quote_post,
    published_at: r.published_at,
    insights: r.post_insights
      ? {
          views: r.post_insights.views ?? 0,
          likes: r.post_insights.likes ?? 0,
          replies: r.post_insights.replies ?? 0,
          reposts: r.post_insights.reposts ?? 0,
          quotes: r.post_insights.quotes ?? 0,
          shares: r.post_insights.shares ?? 0,
          engagement_rate: Number(r.post_insights.engagement_rate ?? 0),
        }
      : null,
  };
}

export interface DashboardSummary {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalReplies: number;
  totalReposts: number;
  totalQuotes: number;
  totalShares: number;
  followers: number | null;
  avgEngagementRate: number;
  byDay: Array<{ date: string; views: number; likes: number; replies: number; reposts: number }>;
  topByEngagement: PostRow[];
  topByViews: PostRow[];
}

export async function getDashboardSummary(userId: string, sinceDays: number): Promise<DashboardSummary> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();

  const posts = await listPosts(userId, { sinceDays });

  const totals = posts.reduce(
    (acc, p) => {
      const i = p.insights ?? { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, shares: 0, engagement_rate: 0 };
      acc.totalViews += i.views;
      acc.totalLikes += i.likes;
      acc.totalReplies += i.replies;
      acc.totalReposts += i.reposts;
      acc.totalQuotes += i.quotes;
      acc.totalShares += i.shares;
      acc.erSum += i.engagement_rate;
      acc.erCount += i.views > 0 ? 1 : 0;
      return acc;
    },
    {
      totalViews: 0,
      totalLikes: 0,
      totalReplies: 0,
      totalReposts: 0,
      totalQuotes: 0,
      totalShares: 0,
      erSum: 0,
      erCount: 0,
    },
  );

  // Daily aggregation
  const byDayMap = new Map<string, { views: number; likes: number; replies: number; reposts: number }>();
  for (let i = sinceDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    byDayMap.set(d.toISOString().slice(0, 10), { views: 0, likes: 0, replies: 0, reposts: 0 });
  }
  for (const p of posts) {
    const day = p.published_at.slice(0, 10);
    const slot = byDayMap.get(day);
    if (!slot || !p.insights) continue;
    slot.views += p.insights.views;
    slot.likes += p.insights.likes;
    slot.replies += p.insights.replies;
    slot.reposts += p.insights.reposts;
  }
  const byDay = [...byDayMap.entries()].map(([date, v]) => ({ date, ...v }));

  const topByEngagement = [...posts]
    .filter((p) => (p.insights?.views ?? 0) > 0)
    .sort((a, b) => (b.insights?.engagement_rate ?? 0) - (a.insights?.engagement_rate ?? 0))
    .slice(0, 5);
  const topByViews = [...posts]
    .sort((a, b) => (b.insights?.views ?? 0) - (a.insights?.views ?? 0))
    .slice(0, 5);

  // Followers from latest account_insights snapshot
  const { data: acc } = await db
    .from("account_insights")
    .select("followers_count")
    .eq("user_id", userId)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    totalPosts: posts.length,
    totalViews: totals.totalViews,
    totalLikes: totals.totalLikes,
    totalReplies: totals.totalReplies,
    totalReposts: totals.totalReposts,
    totalQuotes: totals.totalQuotes,
    totalShares: totals.totalShares,
    followers: acc?.followers_count ?? null,
    avgEngagementRate: totals.erCount ? totals.erSum / totals.erCount : 0,
    byDay,
    topByEngagement,
    topByViews,
  };
}

export async function getSyncState(userId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("sync_state").select("*").eq("user_id", userId).maybeSingle();
  return data;
}
