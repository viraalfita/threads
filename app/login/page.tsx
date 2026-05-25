import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Safe post-login redirect: must be a same-origin path. */
function safeNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "/dashboard";
  // Only allow same-origin paths (starts with "/" but not "//" which would be protocol-relative).
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const next = safeNext(searchParams.next);
  if (await getSession()) redirect(next);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">ThreadLens</h1>
          <p className="text-sm text-muted-foreground">Masuk untuk melanjutkan.</p>
        </div>
        <LoginForm next={next} />
        <p className="text-center text-xs text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="underline">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}
