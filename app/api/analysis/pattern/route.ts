import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveUser } from "@/lib/user";
import { chat } from "@/lib/llm/openrouter";
import { buildPatternPrompt } from "@/lib/analysis/prompts";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "not_connected" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const periodDays = Number(body?.period_days ?? 30);
  const sampleSize = Math.min(Number(body?.sample_size ?? 20), 30);

  const db = supabaseAdmin();
  const since = new Date(Date.now() - periodDays * 86400_000).toISOString();

  const { data: posts, error } = await db
    .from("posts")
    .select("id, text, post_insights ( views, engagement_rate )")
    .eq("user_id", user.id)
    .gte("published_at", since);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (posts ?? [])
    .map((p: any) => ({
      text: p.text,
      views: p.post_insights?.views ?? 0,
      engagement_rate: Number(p.post_insights?.engagement_rate ?? 0),
    }))
    .filter((p) => p.views > 0);

  if (enriched.length < 4) {
    return NextResponse.json(
      { error: `not_enough_data (need >=4 posts with views in last ${periodDays}d, got ${enriched.length})` },
      { status: 400 },
    );
  }

  const sorted = [...enriched].sort((a, b) => b.engagement_rate - a.engagement_rate);
  const top = sorted.slice(0, sampleSize).map((p) => ({
    text: p.text,
    views: p.views,
    engagementRate: p.engagement_rate,
  }));
  const bottom = sorted.slice(-sampleSize).map((p) => ({
    text: p.text,
    views: p.views,
    engagementRate: p.engagement_rate,
  }));

  const prompt = buildPatternPrompt({ periodDays, topPosts: top, bottomPosts: bottom });

  const model = env.openrouterAnalysisModel();
  const llm = await chat({
    model,
    messages: [
      { role: "system", content: "Kamu content strategist Threads yang detect pattern dengan presisi tinggi." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 1200,
  });

  const output = llm.choices?.[0]?.message?.content ?? "(no output)";
  await db.from("llm_analysis").insert({
    user_id: user.id,
    type: "pattern",
    input_context: { periodDays, sampleSize, topCount: top.length, bottomCount: bottom.length },
    output,
    model_used: model,
    prompt_tokens: llm.usage?.prompt_tokens ?? null,
    completion_tokens: llm.usage?.completion_tokens ?? null,
  });

  return NextResponse.json({ output, model, periodDays, sample: { top: top.length, bottom: bottom.length } });
}
