import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { ACTIVE_ACCOUNT_COOKIE, getActiveUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const explicitId = typeof body?.userId === "string" ? body.userId : undefined;
  const target = explicitId ?? (await getActiveUser())?.id;
  if (!target) return NextResponse.json({ ok: true, note: "not_connected" });

  const db = supabaseAdmin();
  // Safety: ensure the row belongs to this admin before deleting
  const { error } = await db
    .from("users")
    .delete()
    .eq("id", target)
    .eq("admin_id", session.sub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ACTIVE_ACCOUNT_COOKIE);
  return res;
}
