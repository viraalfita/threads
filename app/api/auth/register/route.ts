import { NextRequest, NextResponse } from "next/server";
import { createAdmin, getAdminByEmail } from "@/lib/admin";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json().catch(() => ({}));

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "email_and_password_required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "password_min_8_chars" }, { status: 400 });
    }

    const existing = await getAdminByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "email_already_registered" }, { status: 409 });
    }

    const admin = await createAdmin(email, password);
    const token = await signSession({ sub: admin.id, email: admin.email });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "register_failed";
    console.error("[api/auth/register]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
