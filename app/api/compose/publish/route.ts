import { NextRequest, NextResponse } from "next/server";
import { getActiveUserToken } from "@/lib/user";
import { publishTextPost, THREADS_TEXT_LIMIT } from "@/lib/threads/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let user, token;
  try {
    ({ user, token } = await getActiveUserToken());
  } catch {
    return NextResponse.json({ error: "not_connected" }, { status: 400 });
  }

  if (!user.scopes?.includes("threads_content_publish")) {
    return NextResponse.json(
      { error: "missing_publish_scope" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? "").trim();

  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > THREADS_TEXT_LIMIT) {
    return NextResponse.json(
      { error: `too_long (max ${THREADS_TEXT_LIMIT})` },
      { status: 400 },
    );
  }

  try {
    const result = await publishTextPost(user.threads_user_id, token, text);
    return NextResponse.json({ ok: true, id: result.id, permalink: result.permalink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "publish_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
