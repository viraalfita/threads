import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForShortToken,
  exchangeForLongLivedToken,
  getMe,
  THREADS_SCOPES,
} from "@/lib/threads/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ACTIVE_ACCOUNT_COOKIE } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${env.appUrl()}/settings?error=${encodeURIComponent(errorDesc ?? error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${env.appUrl()}/settings?error=missing_code_or_state`);
  }

  const cookieState = req.cookies.get("threads_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(`${env.appUrl()}/settings?error=state_mismatch`);
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(`${env.appUrl()}/login?error=session_expired`);
  }

  try {
    const short = await exchangeCodeForShortToken(code);
    const long = await exchangeForLongLivedToken(short.access_token);
    const me = await getMe(long.access_token);

    const db = supabaseAdmin();
    const encrypted = encryptToken(long.access_token);
    const expiresAt = new Date(Date.now() + long.expires_in * 1000).toISOString();

    const { data, error: upsertErr } = await db
      .from("users")
      .upsert(
        {
          admin_id: session.sub,
          threads_user_id: me.id,
          username: me.username ?? null,
          name: me.name ?? null,
          threads_profile_picture_url: me.threads_profile_picture_url ?? null,
          access_token_encrypted: encrypted,
          token_expires_at: expiresAt,
          scopes: THREADS_SCOPES,
        },
        { onConflict: "threads_user_id" },
      )
      .select("id")
      .single();

    if (upsertErr) throw new Error(upsertErr.message);

    // Initialize sync_state row (ignore if already exists)
    await db.from("sync_state").upsert({ user_id: data!.id, status: "idle" });

    const res = NextResponse.redirect(`${env.appUrl()}/settings?connected=1`);
    res.cookies.delete("threads_oauth_state");
    // Make the newly connected account active
    res.cookies.set(ACTIVE_ACCOUNT_COOKIE, data!.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_callback_failed";
    return NextResponse.redirect(`${env.appUrl()}/settings?error=${encodeURIComponent(msg)}`);
  }
}
