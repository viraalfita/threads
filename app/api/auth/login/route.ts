import { NextRequest, NextResponse } from "next/server";
import { getAdminByEmail, verifyPassword } from "@/lib/admin";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json().catch(() => ({}));

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "email_and_password_required" }, { status: 400 });
    }

    const admin = await getAdminByEmail(email);
    if (!admin || !(await verifyPassword(password, admin.password_hash))) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const token = await signSession({ sub: admin.id, email: admin.email });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "login_failed";
    console.error("[api/auth/login]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
