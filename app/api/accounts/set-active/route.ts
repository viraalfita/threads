import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { ACTIVE_ACCOUNT_COOKIE } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { userId } = await req.json().catch(() => ({}));
  if (typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Verify ownership
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("admin_id", session.sub)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_ACCOUNT_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
