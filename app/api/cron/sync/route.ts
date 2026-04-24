import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { syncUser } from "@/lib/sync";
import { env } from "@/lib/env";
import type { AppUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const expected = env.cronSecret();
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = new URL(req.url).searchParams.get("secret");
  return header === expected || query === expected;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db.from("users").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = (data ?? []) as AppUser[];
  if (users.length === 0) return NextResponse.json({ skipped: "no_users" });

  const results: Record<string, unknown> = {};
  for (const user of users) {
    try {
      results[user.id] = await syncUser(user);
    } catch (e) {
      results[user.id] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ synced: users.length, results });
}
