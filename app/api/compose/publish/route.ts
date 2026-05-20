import { NextRequest, NextResponse } from "next/server";
import { getActiveUserToken } from "@/lib/user";
import { publishThreadChain, THREADS_TEXT_LIMIT } from "@/lib/threads/api";

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
  // Accept either a single post (`text`) or a thread chain (`segments`).
  const rawSegments: string[] = Array.isArray(body?.segments)
    ? body.segments.map((s: unknown) => String(s ?? ""))
    : [String(body?.text ?? "")];
  const segments = rawSegments.map((s) => s.trim()).filter(Boolean);

  if (segments.length === 0) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (segments.some((s) => s.length > THREADS_TEXT_LIMIT)) {
    return NextResponse.json(
      { error: `too_long (max ${THREADS_TEXT_LIMIT} per part)` },
      { status: 400 },
    );
  }

  try {
    const result = await publishThreadChain(user.threads_user_id, token, segments);
    return NextResponse.json({
      ok: true,
      ids: result.ids,
      count: result.ids.length,
      permalink: result.permalink,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "publish_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
