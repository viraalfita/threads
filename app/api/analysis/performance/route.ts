import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveUser } from "@/lib/user";
import { chat } from "@/lib/llm/openrouter";
import { buildPerformancePrompt } from "@/lib/analysis/prompts";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "analysis_failed";
    console.error("[api/analysis/performance]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handle(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "not_connected" }, { status: 400 });

  const { post_id } = await req.json();
  if (!post_id) return NextResponse.json({ error: "post_id required" }, { status: 400 });

  const db = supabaseAdmin();

  const { data: post, error: pErr } = await db
    .from("posts")
    .select("id, text, published_at, post_insights ( views, likes, replies, reposts, quotes, shares, engagement_rate )")
    .eq("id", post_id)
    .eq("user_id", user.id)
    .single();
  if (pErr || !post) return NextResponse.json({ error: pErr?.message ?? "post not found" }, { status: 404 });

  const ins = (post as any).post_insights ?? {};

  // Account averages over last 30 days
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: recent, error: rErr } = await db
    .from("posts")
    .select("post_insights ( views, engagement_rate )")
    .eq("user_id", user.id)
    .gte("published_at", since);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const insights = (recent ?? [])
    .map((r: any) => r.post_insights)
    .filter(Boolean) as Array<{ views: number; engagement_rate: number }>;
  const avgViews = insights.length
    ? Math.round(insights.reduce((s, x) => s + (x.views ?? 0), 0) / insights.length)
    : 0;
  const avgEr = insights.length
    ? insights.reduce((s, x) => s + Number(x.engagement_rate ?? 0), 0) / insights.length
    : 0;

  const prompt = buildPerformancePrompt({
    avgViews,
    avgEngagementRate: avgEr,
    post: {
      text: post.text,
      publishedAt: post.published_at,
      views: ins.views ?? 0,
      likes: ins.likes ?? 0,
      replies: ins.replies ?? 0,
      reposts: ins.reposts ?? 0,
      quotes: ins.quotes ?? 0,
      shares: ins.shares ?? 0,
      engagementRate: Number(ins.engagement_rate ?? 0),
    },
  });

  const model = env.openrouterAnalysisModel();
  const llm = await chat({
    model,
    messages: [
      { role: "system", content: "Kamu content strategist Threads yang spesifik dan ringkas." },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 800,
  });

  const output = llm.choices?.[0]?.message?.content ?? "(no output)";
  await db.from("llm_analysis").insert({
    user_id: user.id,
    post_id: post.id,
    type: "performance",
    input_context: { avgViews, avgEr, ins },
    output,
    model_used: model,
    prompt_tokens: llm.usage?.prompt_tokens ?? null,
    completion_tokens: llm.usage?.completion_tokens ?? null,
  });

  return NextResponse.json({ output, model });
}
