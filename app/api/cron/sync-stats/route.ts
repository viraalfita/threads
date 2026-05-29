import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncReplizStats } from "@/lib/repliz/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const expected = env.cronSecret();
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = new URL(req.url).searchParams.get("secret");
  return header === expected || query === expected;
}

/**
 * Daily cron: pull Repliz post statistics into repliz_post_performance.
 * Guarded by CRON_SECRET (Bearer header or ?secret=). The MCP only reads the
 * synced data, so the agent never triggers this N+1 work itself.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await syncReplizStats();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
