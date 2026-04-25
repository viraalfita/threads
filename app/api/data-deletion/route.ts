import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Meta Data Deletion Callback.
 * Spec: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 *
 * Meta POSTs a `signed_request` form param. We verify it with the app secret,
 * extract the threads `user_id`, delete that user's data from our DB,
 * and return JSON: { url, confirmation_code }.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const signed = form.get("signed_request");
    if (typeof signed !== "string") {
      return NextResponse.json({ error: "missing_signed_request" }, { status: 400 });
    }

    const payload = parseSignedRequest(signed, env.metaAppSecret());
    if (!payload) {
      return NextResponse.json({ error: "invalid_signed_request" }, { status: 400 });
    }

    const threadsUserId = String(payload.user_id ?? "");
    const confirmationCode = crypto.randomBytes(8).toString("hex");

    if (threadsUserId) {
      const db = supabaseAdmin();
      // Delete the threads user row — cascades to posts, insights, history, sync_state, llm_analysis
      await db.from("users").delete().eq("threads_user_id", threadsUserId);
    }

    const statusUrl = `${env.appUrl()}/data-deletion-status?code=${confirmationCode}`;
    return NextResponse.json({ url: statusUrl, confirmation_code: confirmationCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "data_deletion_failed";
    console.error("[api/data-deletion]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Verifies and decodes Meta's HMAC-SHA256 signed_request format. */
function parseSignedRequest(signed: string, secret: string): Record<string, unknown> | null {
  const [encodedSig, encodedPayload] = signed.split(".");
  if (!encodedSig || !encodedPayload) return null;

  const sig = base64UrlDecodeToBuf(encodedSig);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();

  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    return null;
  }

  try {
    const json = base64UrlDecodeToBuf(encodedPayload).toString("utf8");
    const parsed = JSON.parse(json);
    if (parsed?.algorithm && String(parsed.algorithm).toUpperCase() !== "HMAC-SHA256") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function base64UrlDecodeToBuf(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64");
}
