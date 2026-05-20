import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveUser } from "@/lib/user";
import { chat } from "@/lib/llm/openrouter";
import { buildComposePrompt, parseDrafts } from "@/lib/analysis/prompts";
import { THREADS_TEXT_LIMIT } from "@/lib/threads/api";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "not_connected" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const brief = String(body?.brief ?? "").slice(0, 1000).trim();
  const count = Math.min(Math.max(Number(body?.count ?? 3), 1), 5);

  // Ground the drafts in the user's best-performing posts (voice + topics).
  const db = supabaseAdmin();
  const { data: posts } = await db
    .from("posts")
    .select("text, post_insights ( views, engagement_rate )")
    .eq("user_id", user.id);

  const topPosts = (posts ?? [])
    .map((p: any) => ({
      text: p.text as string | null,
      views: Number(p.post_insights?.views ?? 0),
      engagementRate: Number(p.post_insights?.engagement_rate ?? 0),
    }))
    .filter((p) => p.views > 0)
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 8);

  const prompt = buildComposePrompt({
    brief,
    count,
    charLimit: THREADS_TEXT_LIMIT,
    topPosts,
  });

  const model = env.openrouterAnalysisModel();
  const llm = await chat({
    model,
    messages: [
      { role: "system", content: "Kamu copywriter Threads yang meniru voice creator dengan presisi." },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 1200,
  });

  const raw = llm.choices?.[0]?.message?.content ?? "";
  const drafts = parseDrafts(raw).map((d) => d.slice(0, THREADS_TEXT_LIMIT));

  if (drafts.length === 0) {
    return NextResponse.json({ error: "no_drafts_generated" }, { status: 502 });
  }

  await db.from("llm_analysis").insert({
    user_id: user.id,
    type: "ideas",
    input_context: { brief, count, groundedOn: topPosts.length },
    output: raw,
    model_used: model,
    prompt_tokens: llm.usage?.prompt_tokens ?? null,
    completion_tokens: llm.usage?.completion_tokens ?? null,
  });

  return NextResponse.json({ drafts, model });
}
